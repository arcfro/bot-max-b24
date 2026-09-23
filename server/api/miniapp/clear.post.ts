import { formFromDeal } from '#shared/miniapp-deal'
import { clearDeal, getClient } from '../../utils/json-store'
import { requireMiniappUser } from '../../utils/miniapp-session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string }>(event)
  const { user } = requireMiniappUser(body?.initData ?? '')
  clearDeal(user.userId)
  return { ...formFromDeal(null), revision: getClient(user.userId)?.updatedAt ?? 0 }
})
