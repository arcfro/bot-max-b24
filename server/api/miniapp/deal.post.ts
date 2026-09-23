import { formFromDeal } from '#shared/miniapp-deal'
import { clearDeal, getClient, saveClient } from '../../utils/json-store'
import { findOrCreateMaxContact, getMaxDealForm } from '../../utils/bitrix-crm'
import { failureMessage } from '../../utils/max-bot'
import { requireMiniappUser } from '../../utils/miniapp-session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string, id?: string }>(event)
  const { user, row } = requireMiniappUser(body?.initData)
  const requested = String(body?.id || '').trim()
  if (requested && !/^\d+$/.test(requested)) {
    throw createError({ statusCode: 400, statusMessage: 'ID сделки — число' })
  }
  const client = getClient(user.userId)
  const dealId = requested || client?.dealId
  if (!dealId) return formFromDeal(null)
  if (!row.bitrixWebhookUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Битрикс24 не подключён' })
  }
  try {
    const form = await getMaxDealForm(row.bitrixWebhookUrl, dealId)
    if (requested && form.id) {
      const contactId = client?.contactId
        || await findOrCreateMaxContact(row.bitrixWebhookUrl, user.userId, user.name)
      saveClient(user.userId, contactId, form.id)
    }
    return form
  }
  catch (error) {
    const message = failureMessage(error, 'Ошибка')
    if (/not found/i.test(message)) {
      if (!requested) {
        clearDeal(user.userId)
        return formFromDeal(null)
      }
      throw createError({ statusCode: 404, statusMessage: 'Сделка не найдена' })
    }
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
