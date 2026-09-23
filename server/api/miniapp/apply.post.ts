import {
  FILE_ATTACHED,
  NO_DEAL,
  WRITTEN,
  dealCreatedReply,
} from '#shared/max-commands'
import { planMiniappForm } from '#shared/miniapp-form'
import {
  attachFilesToDeal,
  createMaxDeal,
  findOrCreateMaxContact,
  findOrCreateNamedContact,
  getMaxDealForm,
  setDealClient,
  updateMaxDeal,
} from '../../utils/bitrix-crm'
import { clearDeal, getClient, saveClient } from '../../utils/json-store'
import { failureMessage } from '../../utils/max-bot'
import { requireMiniappUser } from '../../utils/miniapp-session'

const FILE_LIMIT = 20 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, statusMessage: 'Пустой запрос' })
  const text = (name: string) => {
    const part = parts.find(item => item.name === name && !item.filename)
    return part ? part.data.toString('utf8') : ''
  }
  const filePart = parts.find(item => item.name === 'file' && item.filename && item.data.length > 0)
  if (filePart && filePart.data.length > FILE_LIMIT) {
    throw createError({ statusCode: 400, statusMessage: 'Файл больше 20 МБ' })
  }

  const { user, row } = requireMiniappUser(text('initData'))
  if (!row.bitrixWebhookUrl) {
    throw createError({ statusCode: 400, statusMessage: 'Битрикс24 не подключён' })
  }

  const client = getClient(user.userId)
  const forceNew = text('newDeal') === '1'
  const plan = planMiniappForm({
    title: text('title'),
    amount: text('amount'),
    begin: text('begin'),
    close: text('close'),
    client: text('client'),
    hasFile: Boolean(filePart),
  }, Boolean(client?.dealId), forceNew)
  if (plan.error) throw createError({ statusCode: 400, statusMessage: plan.error })

  const webhook = row.bitrixWebhookUrl
  const lines: string[] = []
  let dealId = client?.dealId ?? null
  try {
    const contactId = await findOrCreateMaxContact(webhook, user.userId, user.name)
    if (plan.create) {
      dealId = await createMaxDeal(webhook, {
        contactId,
        title: plan.create.title,
        opportunity: plan.create.opportunity,
      })
      saveClient(user.userId, contactId, dealId)
      lines.push(text('title').trim() ? dealCreatedReply(dealId) : WRITTEN)
    }
    if (plan.patch) {
      if (!dealId) throw new Error(NO_DEAL)
      await updateMaxDeal(webhook, dealId, plan.patch)
      if (!lines.includes(WRITTEN)) lines.push(WRITTEN)
    }
    if (plan.client) {
      if (!dealId) throw new Error(NO_DEAL)
      const namedId = await findOrCreateNamedContact(webhook, plan.client.name)
      await setDealClient(webhook, dealId, namedId)
      if (!lines.includes(WRITTEN)) lines.push(WRITTEN)
    }
    if (plan.attach && filePart) {
      if (!dealId) throw new Error(NO_DEAL)
      await attachFilesToDeal(webhook, dealId, [{
        name: safeFileName(filePart.filename),
        body: filePart.data,
      }])
      lines.push(FILE_ATTACHED)
    }
    if (!dealId) throw new Error(NO_DEAL)
    saveClient(user.userId, contactId, dealId)
    const deal = await getMaxDealForm(webhook, dealId)
    return { ...deal, revision: getClient(user.userId)?.updatedAt ?? 0, message: lines.join('\n') || WRITTEN }
  }
  catch (error) {
    const message = failureMessage(error, 'Ошибка')
    if (!plan.create && client?.dealId && /not found/i.test(message)) clearDeal(user.userId)
    throw createError({ statusCode: 502, statusMessage: message })
  }
})

function safeFileName(name: string | undefined): string {
  const cleaned = (name || '')
    .replace(/[/\\:\0]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)
  return cleaned || 'file'
}
