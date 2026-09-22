# Деплой bot-max-b24 на VDS (как dz-web)

Цель: `https://max.ingeo-lab.ru` → Caddy → `127.0.0.1:3001` → systemd `bot-max-b24`.

## Один раз на сервере

Уже сделано при первом выкате (или повтори):

```bash
mkdir -p /opt/bot-max-b24/data
# .env с NUXT_SESSION_PASSWORD, ADMINS, NUXT_PUBLIC_APP_URL, HOST, PORT, DATA_DIR
cp deploy/systemd/bot-max-b24.service /etc/systemd/system/
# Caddy: блок max.ingeo-lab.ru → reverse_proxy 127.0.0.1:3001
systemctl daemon-reload
systemctl enable --now bot-max-b24
systemctl reload caddy
```

`.env` и `data/` CI **не** перезаписывает.

## CI/CD (GitHub → VDS)

Пуш в `main` (или Actions → **Deploy**) собирает на Ubuntu и подменяет `/opt/bot-max-b24/.output`.

Secrets репозитория:

| Secret | Значение |
|--------|----------|
| `DEPLOY_HOST` | `5.181.255.134` |
| `DEPLOY_USER` | `root` |
| `DEPLOY_SSH_KEY` | приватный ed25519 для деплоя |

DNS: `max.ingeo-lab.ru` → A на IP VDS (уже должен смотреть сюда).
