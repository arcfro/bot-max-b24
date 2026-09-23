import { getClient } from '../../utils/json-store'
import { requireMiniappUser } from '../../utils/miniapp-session'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ initData?: string }>(event)
  const { user } = requireMiniappUser(body?.initData)
  const client = getClient(user.userId)
  return {
    dealId: client?.dealId ?? null,
    updatedAt: client?.updatedAt ?? 0,
  }
})
