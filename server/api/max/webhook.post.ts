import { handleMaxUpdate } from '../../utils/max-inbox'
import { getMaxIntegration, secretsMatch } from '../../utils/max-bot'

export default defineEventHandler(async (event) => {
  const row = getMaxIntegration()
  if (!row?.webhookSecret) {
    throw createError({ statusCode: 404, statusMessage: 'MAX не подключён' })
  }
  const got = getHeader(event, 'x-max-bot-api-secret') || ''
  if (!secretsMatch(got, row.webhookSecret)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  const update = await readBody(event).catch(() => null)
  try {
    await handleMaxUpdate(update)
  }
  catch (error) {
    console.error('[max] webhook', error)
  }
  return { ok: true }
})
