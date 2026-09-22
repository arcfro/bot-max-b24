import { parseMaxAllowList } from '#shared/max-commands'
import { publicOrigin } from '../../utils/public-origin'
import { saveSettings } from '../../utils/json-store'
import {
  bitrixWebhookBase,
  bitrixWebhookProblem,
  failureMessage,
  fetchMaxBot,
  getMaxIntegration,
  httpsWebhookProblem,
  makeMaxWebhookSecret,
  maxIntegrationStatus,
  maxWebhookUrl,
  subscribeMaxBot,
  verifyBitrixWebhook,
} from '../../utils/max-bot'

async function requireAdmin(event: Parameters<typeof getUserSession>[0]) {
  const session = await getUserSession(event)
  if (!session.user?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{
    token?: string
    bitrixWebhook?: string
    allowFrom?: string
    allowlistEnabled?: boolean
  }>(event)
  const incomingToken = String(body?.token || '').trim()
  const incomingBitrix = String(body?.bitrixWebhook || '').trim()
  const saveAllowlist = !!body && Object.prototype.hasOwnProperty.call(body, 'allowFrom')
  if (!incomingToken && !incomingBitrix && !saveAllowlist) {
    throw createError({ statusCode: 400, statusMessage: 'Вставьте токен бота или вебхук Битрикс24' })
  }
  const allowPatch = saveAllowlist
    ? {
        allowFrom: parseMaxAllowList(String(body?.allowFrom ?? '')).join('\n'),
        allowFromEnabled: Boolean(body?.allowlistEnabled),
      }
    : null

  const existing = getMaxIntegration()
  let tokenError: string | null = null
  let bitrixError: string | null = null
  let tokenPatch: {
    botToken: string
    webhookSecret: string
    webhookUrl: string
    botUserId: number | null
    botName: string | null
    subscribedAt: number
  } | null = null
  let bitrixPatch: string | null = null

  const jobs: Promise<void>[] = []

  if (incomingToken) {
    jobs.push((async () => {
      if (incomingToken.length < 8) {
        tokenError = 'Вставьте токен бота'
        return
      }
      const webhookUrl = maxWebhookUrl(publicOrigin(event))
      const problem = httpsWebhookProblem(webhookUrl)
      if (problem) {
        tokenError = problem
        return
      }
      try {
        const bot = await fetchMaxBot(incomingToken)
        const secret = existing?.webhookSecret || makeMaxWebhookSecret()
        await subscribeMaxBot(incomingToken, webhookUrl, secret)
        tokenPatch = {
          botToken: incomingToken,
          webhookSecret: secret,
          webhookUrl,
          botUserId: bot.userId,
          botName: bot.name,
          subscribedAt: Date.now(),
        }
      }
      catch (error) {
        tokenError = failureMessage(error, 'Токен бота не принят')
      }
    })())
  }

  if (incomingBitrix) {
    jobs.push((async () => {
      const problem = bitrixWebhookProblem(incomingBitrix)
      if (problem) {
        bitrixError = problem
        return
      }
      try {
        await verifyBitrixWebhook(incomingBitrix)
        bitrixPatch = bitrixWebhookBase(incomingBitrix)
      }
      catch (error) {
        bitrixError = failureMessage(error, 'Вебхук Битрикс24 не принят')
      }
    })())
  }

  await Promise.all(jobs)

  if (tokenPatch || bitrixPatch || allowPatch) {
    saveSettings({
      ...(tokenPatch ?? {}),
      ...(bitrixPatch ? { bitrixWebhookUrl: bitrixPatch } : {}),
      ...(allowPatch ?? {}),
    })
  }

  return maxIntegrationStatus(getMaxIntegration(), { tokenError, bitrixError })
})
