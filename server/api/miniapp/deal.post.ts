import { clearDeal, getClient } from '../../utils/json-store'
import { getMaxDeal } from '../../utils/bitrix-crm'
import { failureMessage } from '../../utils/max-bot'
import { requireMiniappUser } from '../../utils/miniapp-session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string }>(event)
  const { user, row } = requireMiniappUser(body?.initData)
  const client = getClient(user.userId)
  if (!client?.dealId) return { id: null, title: null }
  if (!row.bitrixWebhookUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Битрикс24 не подключён' })
  }
  try {
    return await getMaxDeal(row.bitrixWebhookUrl, client.dealId)
  }
  catch (error) {
    const message = failureMessage(error, 'Ошибка')
    if (/not found/i.test(message)) {
      clearDeal(user.userId)
      return { id: null, title: null }
    }
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
