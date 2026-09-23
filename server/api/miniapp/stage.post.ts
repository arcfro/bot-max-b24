import { WRITTEN } from '#shared/max-commands'
import { parseStageId } from '#shared/miniapp-id'
import { getMaxDealForm, updateMaxDeal } from '../../utils/bitrix-crm'
import { getClient } from '../../utils/json-store'
import { failureMessage, resolveBitrixWebhooks } from '../../utils/max-bot'
import { requireMiniappUser } from '../../utils/miniapp-session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string, stageId?: string }>(event)
  const { user, row } = requireMiniappUser(body?.initData ?? '')
  const hooks = resolveBitrixWebhooks(row)
  if (!hooks.main) {
    throw createError({ statusCode: 400, statusMessage: 'Битрикс24 не подключён' })
  }
  const client = getClient(user.userId)
  if (!client?.dealId) {
    throw createError({ statusCode: 400, statusMessage: 'Нет активной сделки' })
  }
  const stageId = parseStageId(body?.stageId)
  if (!stageId) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректная стадия' })
  }

  const webhook = hooks.main
  const dealId = client.dealId
  try {
    await updateMaxDeal(webhook, dealId, { stageId })
    const deal = await getMaxDealForm(webhook, dealId)
    return { ...deal, revision: getClient(user.userId)?.updatedAt ?? 0, message: WRITTEN }
  }
  catch (error) {
    throw createError({ statusCode: 502, statusMessage: failureMessage(error, 'Ошибка') })
  }
})
