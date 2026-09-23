import { NO_DEAL } from '#shared/max-commands'
import { deleteDealFile, getMaxDealForm } from '../../utils/bitrix-crm'
import { getClient } from '../../utils/json-store'
import { failureMessage } from '../../utils/max-bot'
import { requireMiniappUser } from '../../utils/miniapp-session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string, fileId?: string }>(event)
  const { user, row } = requireMiniappUser(body?.initData)
  if (!row.bitrixWebhookUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Битрикс24 не подключён' })
  }

  const client = getClient(user.userId)
  if (!client?.dealId) {
    throw createError({ statusCode: 400, statusMessage: NO_DEAL })
  }

  const fileId = String(body?.fileId || '').trim()
  if (!fileId) {
    throw createError({ statusCode: 400, statusMessage: 'Не указан файл' })
  }

  try {
    await deleteDealFile(row.bitrixWebhookUrl, client.dealId, fileId)
    const deal = await getMaxDealForm(row.bitrixWebhookUrl, client.dealId)
    return { ...deal, revision: getClient(user.userId)?.updatedAt ?? 0, message: 'Файл удалён' }
  }
  catch (error) {
    const message = failureMessage(error, 'Ошибка')
    if (/not found|не найден/i.test(message)) {
      throw createError({ statusCode: 404, statusMessage: 'Файл не найден' })
    }
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
