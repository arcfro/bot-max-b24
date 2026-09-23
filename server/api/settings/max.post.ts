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
  verifyBitrixCategoryWebhook,
  verifyBitrixStatusWebhook,
  verifyBitrixWebhook,
} from '../../utils/max-bot'
import { requireAdmin } from '../../utils/require-admin'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody<{
    token?: string
    bitrixWebhook?: string
    bitrixCategoryWebhook?: string
    bitrixStatusWebhook?: string
    allowFrom?: string
    allowlistEnabled?: boolean
  }>(event)
  const incomingToken = String(body?.token || '').trim()
  const incomingBitrix = String(body?.bitrixWebhook || '').trim()
  const incomingBitrixCategory = String(body?.bitrixCategoryWebhook || '').trim()
  const incomingBitrixStatus = String(body?.bitrixStatusWebhook || '').trim()
  const saveAllowlist = !!body && Object.prototype.hasOwnProperty.call(body, 'allowFrom')
  if (!incomingToken && !incomingBitrix && !incomingBitrixCategory && !incomingBitrixStatus && !saveAllowlist) {
    throw createError({ statusCode: 400, statusMessage: 'Заполните хотя бы одно поле для сохранения' })
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
  let bitrixCategoryError: string | null = null
  let bitrixStatusError: string | null = null
  let tokenPatch: {
    botToken: string
    webhookSecret: string
    webhookUrl: string
    botUserId: number | null
    botName: string | null
    subscribedAt: number
  } | null = null
  let bitrixPatch: string | null = null
  let bitrixCategoryPatch: string | null = null
  let bitrixStatusPatch: string | null = null

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

  if (incomingBitrixCategory) {
    jobs.push((async () => {
      const problem = bitrixWebhookProblem(incomingBitrixCategory)
      if (problem) {
        bitrixCategoryError = problem
        return
      }
      try {
        await verifyBitrixCategoryWebhook(incomingBitrixCategory)
        bitrixCategoryPatch = bitrixWebhookBase(incomingBitrixCategory)
      }
      catch (error) {
        bitrixCategoryError = failureMessage(error, 'Вебхук crm.dealcategory.list не принят')
      }
    })())
  }

  if (incomingBitrixStatus) {
    jobs.push((async () => {
      const problem = bitrixWebhookProblem(incomingBitrixStatus)
      if (problem) {
        bitrixStatusError = problem
        return
      }
      try {
        await verifyBitrixStatusWebhook(incomingBitrixStatus)
        bitrixStatusPatch = bitrixWebhookBase(incomingBitrixStatus)
      }
      catch (error) {
        bitrixStatusError = failureMessage(error, 'Вебхук crm.status.list не принят')
      }
    })())
  }

  await Promise.all(jobs)

  if (tokenPatch || bitrixPatch || bitrixCategoryPatch || bitrixStatusPatch || allowPatch) {
    saveSettings({
      ...(tokenPatch ?? {}),
      ...(bitrixPatch ? { bitrixWebhookUrl: bitrixPatch } : {}),
      ...(bitrixCategoryPatch ? { bitrixCategoryWebhookUrl: bitrixCategoryPatch } : {}),
      ...(bitrixStatusPatch ? { bitrixStatusWebhookUrl: bitrixStatusPatch } : {}),
      ...(allowPatch ?? {}),
    })
  }

  return maxIntegrationStatus(getMaxIntegration(), {
    tokenError,
    bitrixError,
    bitrixCategoryError,
    bitrixStatusError,
  })
})
