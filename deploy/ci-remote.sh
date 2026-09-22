#!/usr/bin/env bash
# Применяет архив /tmp/bot-max-b24-output.tar.gz из GitHub Actions.
# Не трогает .env и data/.
set -euo pipefail

APP_DIR="${DEPLOY_PATH:-/opt/bot-max-b24}"
ARCHIVE="${DEPLOY_ARCHIVE:-/tmp/bot-max-b24-output.tar.gz}"
SERVICE="${DEPLOY_SERVICE:-bot-max-b24}"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Нет архива $ARCHIVE" >&2
  df -h / >&2 || true
  exit 1
fi

systemctl stop "$SERVICE"
rm -rf "$APP_DIR/.output"
mkdir -p "$APP_DIR/.output"
tar -xzf "$ARCHIVE" -C "$APP_DIR/.output"
rm -f "$ARCHIVE"
chown -R dz:dz "$APP_DIR/.output"
systemctl start "$SERVICE"
systemctl --no-pager --lines=20 status "$SERVICE"
