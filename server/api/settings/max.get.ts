import { getMaxIntegration, maxIntegrationStatus } from '../../utils/max-bot'

async function requireAdmin(event: Parameters<typeof getUserSession>[0]) {
  const session = await getUserSession(event)
  if (!session.user?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return session
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return maxIntegrationStatus(getMaxIntegration())
})
