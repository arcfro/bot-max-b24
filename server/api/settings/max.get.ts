import { getMaxIntegration, maxIntegrationStatus } from '../../utils/max-bot'
import { requireAdmin } from '../../utils/require-admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return maxIntegrationStatus(getMaxIntegration())
})
