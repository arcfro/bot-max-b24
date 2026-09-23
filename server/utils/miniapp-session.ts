import { MAX_DENIED, maxSenderAllowed } from '#shared/max-commands'
import type { MaxSettings } from './json-store'
import { getMaxIntegration } from './max-bot'
import { readMaxInitData, type MaxInitUser } from './max-init-data'

export function requireMiniappUser(initData: string | undefined): { user: MaxInitUser, row: MaxSettings } {
  const row = getMaxIntegration()
  if (!row.botToken) {
    throw createError({ statusCode: 503, statusMessage: 'Бот не подключён' })
  }
  const user = readMaxInitData(String(initData || ''), row.botToken, Math.floor(Date.now() / 1000))
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Откройте экран из MAX' })
  }
  if (!maxSenderAllowed(Boolean(row.allowFromEnabled), row.allowFrom || '', {
    userId: user.userId,
    username: user.username,
  })) {
    throw createError({ statusCode: 403, statusMessage: MAX_DENIED })
  }
  return { user, row }
}
