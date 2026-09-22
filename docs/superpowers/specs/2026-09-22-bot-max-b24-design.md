# bot-max-b24 — дизайн

Отдельное Nuxt-приложение: бот MAX ↔ CRM Битрикс24, вынесенное из интеграции «Платформа» в `dz-web`. Без SQLite, без организаций/лицензий/DZ/SZ.

## Цели

- Тот же стек, что у `dz-web` (Nuxt 4, Vue 3, TypeScript, Pinia, `nuxt-auth-utils`, Vitest), **без** better-sqlite3 / Drizzle.
- Поведение бота и CRM 1:1 с `dz-web` (команды, контакты, сделки, вложения, allowlist, welcome/deny, дедуп mid).
- Админ-UI: только настройки — без меню платформы и обзора организаций.
- Авторизация: несколько админов из JSON в `.env` (`ADMINS`), пароли plaintext, как задано.

## Вне скоупа

- Организации, лицензии, бэкап БД, инвайты, DZ/SZ.
- Хеширование паролей админов.
- Мультитенантность / синхронизация с `dz-web`.
- Общий npm-пакет с `dz-web` (код копируем; дальше можно расходиться).

## Архитектура

```
/Users/arcfro/ingeo/bot-max-b24/   (рядом с dz-web)
├── app/
│   ├── pages/index.vue      # настройки (нужна сессия)
│   ├── pages/login.vue
│   ├── layouts/default.vue  # пустая оболочка, «Выйти» только на /
│   └── assets/css/main.css  # урезанный из dz-web
├── shared/
│   └── max-commands.ts      # копия из dz-web
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
├── data/                    # в .gitignore; runtime JSON
└── tests/
```

SSR выключен (SPA). Алиас Nitro `#shared` → `./shared`.

## Авторизация

- Env: `ADMINS=[{"email":"a@x","password":"..."},...]` (JSON-массив).
- Env: `NUXT_SESSION_PASSWORD` (≥32 символов) для sealed cookie (`nuxt-auth-utils`).
- `POST /api/auth/login` — email без учёта регистра, пароль точное совпадение; при успехе `setUserSession({ user: { email } })`.
- `POST /api/auth/logout`, `GET /api/auth/me`.
- Middleware: все маршруты кроме `/login` и `POST /api/max/webhook` требуют сессию.
- Маршруты: `/` = настройки; без сессии → `/login`. После логина → `/`.

## UI настроек (`/`)

Порт карточки «Интеграция с MAX» из `dz-web` `app/pages/platform/index.vue`:

- Токен бота (password-поле; пусто = оставить сохранённый)
- URL входящего вебхука Битрикс24
- «Подключить» — проверяет только заполненные поля; токен дополнительно подписывает бота на публичный HTTPS-webhook
- Allowlist: флаг + textarea; «Сохранить список»
- Статус: имя бота, subscribedAt, URL webhook, хост Битрикс24, ошибки
- «Выйти»

Без KPI по организациям, бэкапа и навигации платформы.

## API

| Метод | Путь | Auth | Назначение |
|--------|------|------|------------|
| GET | `/api/settings/max` | сессия | статус (форма `PlatformMaxStatus`; без секретов) |
| POST | `/api/settings/max` | сессия | подключение / патч allowlist (семантика тела как у `platform/max.post`) |
| POST | `/api/max/webhook` | секрет webhook | апдейты MAX → `handleMaxUpdate` |
| POST | `/api/auth/login` | публичный | |
| POST | `/api/auth/logout` | сессия | |
| GET | `/api/auth/me` | сессия | |

URL webhook: `{NUXT_PUBLIC_APP_URL}/api/max/webhook` (те же правила HTTPS, что `publicOrigin` / `httpsWebhookProblem` в dz-web).

## Хранение (JSON-файлы)

Каталог: `DATA_DIR` или `./data`. Создаётся при первой записи. Содержимое в `.gitignore`; при необходимости — `*.example.json`.

### `settings.json`

Один объект (бывшая строка `max_integration`):

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

### Протокол записи

- Read → mutate → запись во временный файл → rename (атомарно, где возможно).
- Перед перезаписью: копия в `*.bak`.
- Битый/отсутствующий файл: state → пустые defaults; settings → пустые defaults (не подключено).
- `claimMid` / `claimGreeting`: семантика insert-if-absent (false, если уже есть).
- Prune записей `seen` старше 30 дней при claim (как в dz-web).

Конкуренция: один процесс Node (как типичный деплой dz-web). Без multi-writer lock, кроме atomic rename.

## Поведение бота / CRM

Копия и адаптация из dz-web (поведение без изменений):

- `shared/max-commands.ts` + тесты
- `server/utils/max-bot.ts` — MAX API, subscribe, проверка Битрикс probe, статус
- `server/utils/bitrix-crm.ts` — контакт / сделка / вложения
- `server/utils/max-inbox.ts` — allowlist, plan, CRM, ответы; хранение через json-store вместо Drizzle
- Хелпер trusted CA — копировать `russian-trusted-cas` только если ещё нужен для HTTPS к MAX/Битрикс

Команды без изменений: Н/Новая, С/Сумма, Дн/Дз даты, К/Клиент, файл, ?/.

## Ошибки

- Подключение: независимые `tokenError` / `bitrixError`; сохраняются только успешно проверенные поля.
- Webhook: плохой секрет → 401; ошибки CRM → ответ пользователю в MAX + лог на сервере.
- Логин: общее «Неверный email или пароль» (без enumeration).
- Сбои JSON I/O → 500 с понятным текстом; `.bak` сохраняется.

## Env

```
NUXT_SESSION_PASSWORD=
ADMINS=[{"email":"admin@example.com","password":"change-me"}]
NUXT_PUBLIC_APP_URL=https://bot.example.com
DATA_DIR=./data
```

Опционально: cookie `secure`, если `APP_URL` на https (или всегда в production).

## Тесты

- Перенос `tests/shared/max-commands.test.ts`
- Адаптация `tests/server/max-bot.test.ts` (без БД)
- Новые: парсинг/матч `ADMINS`; json-store claimMid/claimGreeting/prune; allowlist, если не покрыт

## Карта исходников (из dz-web)

| Источник | Куда |
|----------|------|
| `shared/max-commands.ts` | то же |
| `shared/platform.ts` (только `PlatformMaxStatus`) | `shared/max-status.ts` или inline |
| `server/utils/max-bot.ts` | то же (без БД; json-store) |
| `server/utils/max-inbox.ts` | то же (json-store) |
| `server/utils/bitrix-crm.ts` | то же |
| `server/api/platform/max.{get,post}.ts` | `server/api/settings/max.*` |
| `server/api/max/webhook.post.ts` | то же |
| Блок UI MAX на платформе | `app/pages/index.vue` |

## Критерии готовности

1. `npm run dev` → `/login` → `/` настройки работают с `ADMINS`.
2. Подключение MAX + Битрикс пишет в `data/settings.json`; показан URL webhook.
3. Входящее сообщение MAX создаёт/обновляет сделку в Битрикс; state в `data/state.json`.
4. Golden-тесты команд проходят; в `package.json` нет зависимости от sqlite.
