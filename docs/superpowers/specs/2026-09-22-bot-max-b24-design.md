# bot-max-b24 — design

Standalone Nuxt app: MAX bot ↔ Bitrix24 CRM, extracted from `dz-web` Platform integration. No SQLite, no orgs/licenses/DZ/SZ.

## Goals

- Same stack as `dz-web` (Nuxt 4, Vue 3, TypeScript, Pinia, `nuxt-auth-utils`, Vitest) **without** better-sqlite3 / Drizzle.
- Full 1:1 bot + CRM behaviour from `dz-web` (commands, contacts, deals, file attach, allowlist, welcome/deny, mid dedup).
- Admin UI: settings only — no platform menus, no org overview.
- Auth: multiple admins from `.env` JSON (`ADMINS`), plaintext passwords as specified.

## Non-goals

- Organizations, licenses, DB backup, invites, DZ/SZ.
- Password hashing for admins.
- Multi-tenant / sync with `dz-web`.
- Shared npm package with `dz-web` (copy code; diverge freely).

## Architecture

```
/Users/arcfro/ingeo/bot-max-b24/   (sibling of dz-web)
├── app/
│   ├── pages/index.vue      # settings (auth required)
│   ├── pages/login.vue
│   ├── layouts/default.vue  # empty shell, logout only on /
│   └── assets/css/main.css  # trimmed from dz-web
├── shared/
│   └── max-commands.ts      # copy from dz-web
├── server/
│   ├── api/auth/{login,logout,me}.*
│   ├── api/settings/max.{get,post}.ts
│   ├── api/max/webhook.post.ts
│   └── utils/
│       ├── max-bot.ts
│       ├── max-inbox.ts
│       ├── bitrix-crm.ts
│       ├── json-store.ts
│       ├── admins.ts
│       └── public-origin.ts
├── data/                    # gitignored; runtime JSON
└── tests/
```

SSR off for the app (SPA). Nitro alias `#shared` → `./shared`.

## Auth

- Env: `ADMINS=[{"email":"a@x","password":"..."},...]` (JSON array).
- Env: `NUXT_SESSION_PASSWORD` (≥32 chars) for sealed cookie (`nuxt-auth-utils`).
- `POST /api/auth/login` — case-insensitive email match, exact password; on success `setUserSession({ user: { email } })`.
- `POST /api/auth/logout`, `GET /api/auth/me`.
- Middleware: all routes except `/login` and `POST /api/max/webhook` require a session.
- Routes: `/` = settings; unauthenticated → `/login`. After login → `/`.

## Settings UI (`/`)

Port of the «Интеграция с MAX» card from `dz-web` `app/pages/platform/index.vue`:

- Bot token (password input; blank = keep stored)
- Bitrix24 incoming webhook URL
- «Подключить» — validates only filled fields; token also subscribes bot to public HTTPS webhook
- Allowlist enable + textarea; «Сохранить список»
- Status lines: connected bot name, subscribedAt, webhook URL, bitrix host, errors
- «Выйти»

No org KPIs, backup, or platform nav.

## API

| Method | Path | Auth | Role |
|--------|------|------|------|
| GET | `/api/settings/max` | session | status (`PlatformMaxStatus`-shaped; no secrets) |
| POST | `/api/settings/max` | session | connect / allowlist patch (same body semantics as `platform/max.post`) |
| POST | `/api/max/webhook` | webhook secret | MAX updates → `handleMaxUpdate` |
| POST | `/api/auth/login` | public | |
| POST | `/api/auth/logout` | session | |
| GET | `/api/auth/me` | session | |

Webhook URL: `{NUXT_PUBLIC_APP_URL}/api/max/webhook` (same HTTPS rules as dz-web `publicOrigin` / `httpsWebhookProblem`).

## Persistence (JSON files)

Directory: `DATA_DIR` or `./data`. Create on first write. Gitignore contents; ship `*.example.json` if useful.

### `settings.json`

One object (was `max_integration` row):

```json
{
  "botToken": null,
  "webhookSecret": null,
  "webhookUrl": null,
  "botUserId": null,
  "botName": null,
  "bitrixWebhookUrl": null,
  "allowFromEnabled": false,
  "allowFrom": "",
  "subscribedAt": null,
  "updatedAt": 0
}
```

### `state.json`

```json
{
  "clients": {
    "<maxUserId>": { "contactId": "...", "dealId": null, "updatedAt": 0 }
  },
  "greeted": { "<maxUserId>": 0 },
  "seen": { "<mid>": 0 }
}
```

### Write protocol

- Read → mutate → write temp → rename (atomic where possible).
- Before overwrite: copy previous to `*.bak`.
- Corrupt/missing file: start from empty defaults for state; settings missing → empty defaults (not connected).
- `claimMid` / `claimGreeting`: insert-if-absent semantics (return false if already present).
- Prune `seen` entries older than 30 days on claim (same as dz-web).

Concurrency: single Node process assumption (same as typical dz-web deploy). No multi-writer locking beyond atomic rename.

## Bot / CRM behaviour

Copy and adapt from dz-web (behaviour unchanged):

- `shared/max-commands.ts` + tests
- `server/utils/max-bot.ts` — MAX API, subscribe, verify Bitrix probe, status helper
- `server/utils/bitrix-crm.ts` — contact/deal/file attach
- `server/utils/max-inbox.ts` — allowlist, plan, CRM calls, replies; storage via json-store instead of Drizzle
- Trusted CAs helper if required for MAX/Bitrix HTTPS (copy `russian-trusted-cas` only if still needed)

Commands remain: Н/Новая, С/Сумма, Дн/Дз dates, К/Клиент, file attach, ?/.

## Error handling

- Connect: independent `tokenError` / `bitrixError`; save only fields that passed.
- Webhook: bad secret → 401; CRM errors → user-facing MAX reply + server log.
- Login: generic «Неверный email или пароль» (no user enumeration).
- JSON I/O failures → 500 with clear message; keep `.bak`.

## Env

```
NUXT_SESSION_PASSWORD=
ADMINS=[{"email":"admin@example.com","password":"change-me"}]
NUXT_PUBLIC_APP_URL=https://bot.example.com
DATA_DIR=./data
```

Optional: session cookie `secure` when `APP_URL` is https (or always in production).

## Tests

- Port `tests/shared/max-commands.test.ts`
- Adapt `tests/server/max-bot.test.ts` (no DB)
- New: `admins` parse/match; json-store claimMid/claimGreeting/prune; allowlist wiring if not already covered

## Source map (from dz-web)

| Source | Destination |
|--------|-------------|
| `shared/max-commands.ts` | same |
| `shared/platform.ts` (`PlatformMaxStatus` only) | `shared/max-status.ts` or inline |
| `server/utils/max-bot.ts` | same (drop DB reads; use json-store) |
| `server/utils/max-inbox.ts` | same (json-store) |
| `server/utils/bitrix-crm.ts` | same |
| `server/api/platform/max.{get,post}.ts` | `server/api/settings/max.*` |
| `server/api/max/webhook.post.ts` | same |
| Platform MAX UI block | `app/pages/index.vue` |

## Success criteria

1. `npm run dev` → `/login` → `/` settings works with `ADMINS`.
2. Connect MAX + Bitrix stores into `data/settings.json`; webhook URL shown.
3. Incoming MAX message creates/updates Bitrix deal; state in `data/state.json`.
4. Golden command tests pass; no sqlite dependency in `package.json`.
