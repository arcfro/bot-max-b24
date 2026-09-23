import { MAX_DENIED, maxSenderAllowed } from '#shared/max-commands'
import type { MaxSettings } from './json-store'
import { getMaxIntegration } from './max-bot'
import { maxInitFailure, readMaxInitData, type MaxInitUser } from './max-init-data'

export function requireMiniappUser(initData: string | undefined): { user: MaxInitUser, row: MaxSettings } {
  const row = getMaxIntegration()
  if (!row.botToken) {
    throw createError({ statusCode: 503, statusMessage: 'Бот не подключён' })
  }
  const nowSec = Math.floor(Date.now() / 1000)
  const raw = String(initData || '')
  const user = readMaxInitData(raw, row.botToken, nowSec)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: `Откройте экран из MAX (${maxInitFailure(raw, row.botToken, nowSec)})` })
  }
  if (!maxSenderAllowed(Boolean(row.allowFromEnabled), row.allowFrom || '', {
    userId: user.userId,
    username: user.username,
  })) {
    throw createError({ statusCode: 403, statusMessage: MAX_DENIED })
  }
  return { user, row }
}
