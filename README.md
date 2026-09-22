# bot-max-b24

Админка настроек бота MAX ↔ Битрикс24. Порт интеграции из `dz-web` Platform, без SQLite.

## Запуск

```bash
cp .env.example .env
# NUXT_SESSION_PASSWORD ≥ 32 символов
# ADMINS='[{"email":"admin@example.com","password":"..."}]'
# NUXT_PUBLIC_APP_URL=https://ваш-публичный-https

npm install
npm run dev
```

Открой `/login` → после входа `/` (настройки).

Webhook MAX: `{NUXT_PUBLIC_APP_URL}/api/max/webhook`

Данные: `DATA_DIR` (по умолчанию `./data`) — `settings.json`, `state.json`.

## Скрипты

- `npm run dev` — разработка
- `npm test` — Vitest
- `npm run build` / `npm start` — прод
