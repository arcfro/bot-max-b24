import { parseCategoryId } from '#shared/miniapp-id'
import { listDealStages } from '../../utils/bitrix-crm'
import { resolveBitrixWebhooks } from '../../utils/max-bot'
import { requireMiniappUser } from '../../utils/miniapp-session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string, categoryId?: string }>(event)
  const { row } = requireMiniappUser(body?.initData ?? '')
  const hooks = resolveBitrixWebhooks(row)
  if (!hooks.main || !hooks.status) {
    throw createError({ statusCode: 400, statusMessage: 'Битрикс24 не подключён' })
  }
  const categoryId = parseCategoryId(body?.categoryId)
  if (categoryId == null) {
    throw createError({ statusCode: 400, statusMessage: 'Некорректная воронка' })
  }
  try {
    const stages = await listDealStages(hooks.status, categoryId)
    return { stages }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
