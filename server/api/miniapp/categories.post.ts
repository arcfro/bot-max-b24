import { listDealCategories } from '../../utils/bitrix-crm'
import { resolveBitrixWebhooks } from '../../utils/max-bot'
import { requireMiniappUser } from '../../utils/miniapp-session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string }>(event)
  const { row } = requireMiniappUser(body?.initData ?? '')
  const hooks = resolveBitrixWebhooks(row)
  if (!hooks.main || !hooks.category) {
    throw createError({ statusCode: 400, statusMessage: 'Битрикс24 не подключён' })
  }
  try {
    const categories = await listDealCategories(hooks.category, Boolean(row.bitrixCategoryWebhookUrl))
    return { categories }
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Ошибка'
    throw createError({ statusCode: 502, statusMessage: message })
  }
})
