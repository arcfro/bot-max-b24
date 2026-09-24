import {
  FILE_ATTACHED,
  MAX_DENIED,
  MAX_WELCOME,
  NO_DEAL,
  WRITTEN,
  dealCreatedReply,
  dealFieldsReply,
  maxSenderAllowed,
  planMaxMessage,
  withDealId,
} from '#shared/max-commands'
import {
  attachFilesToDeal,
  createMaxDeal,
  findOrCreateMaxContact,
  findOrCreateNamedContact,
  getDealFiles,
  getMaxDealForm,
  setDealClient,
  updateMaxDeal,
} from './bitrix-crm'
import {
  claimGreeting,
  claimMid,
  clearDeal,
  getClient,
  saveClient,
} from './json-store'
import {
  downloadMaxFile,
  failureMessage,
  getMaxIntegration,
  maxMediaUrl,
  sendMaxMessage,
} from './max-bot'

const MEDIA = new Set(['image', 'video', 'audio', 'file'])
const EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/pdf': '.pdf',
  'video/mp4': '.mp4',
  'audio/mpeg': '.mp3',
}

type MaxAttachment = {
  type?: string
  filename?: string
  payload?: { url?: string, token?: string, filename?: string, name?: string }
}

type MessageBody = {
  mid?: string
  text?: string | null
  attachments?: MaxAttachment[]
}

type LinkedMessage = {
  type?: string
  message?: MessageBody
}

type Incoming = {
  kind: 'message' | 'start'
  mid: string | null
  text: string
  chatId: number | null
  userId: string
  userIdNum: number
  username: string | null
  name: string
  isBot: boolean
  attachments: MaxAttachment[]
}

export async function handleMaxUpdate(update: unknown) {
  const message = readMaxIncoming(update) ?? readStart(update)
  if (!message || message.isBot) return

  const row = getMaxIntegration()
  if (!row?.botToken) return
  if (row.botUserId != null && message.userIdNum === row.botUserId) return
  if (!maxSenderAllowed(Boolean(row.allowFromEnabled), row.allowFrom || '', {
    userId: message.userId,
    username: message.username,
  })) {
    if (message.mid && !claimMid(message.mid)) return
    await sendMaxMessage(row.botToken, {
      chatId: message.chatId,
      userId: message.userIdNum,
    }, MAX_DENIED).catch((error) => {
      console.error('[max] reply failed', failureMessage(error, 'reply'))
    })
    return
  }

  const token = row.botToken
  const reply = (text: string) => sendMaxMessage(token, {
    chatId: message.chatId,
    userId: message.userIdNum,
  }, text).catch((error) => {
    console.error('[max] reply failed', failureMessage(error, 'reply'))
  })

  if (message.kind === 'start') {
    if (claimGreeting(message.userId)) await reply(MAX_WELCOME)
    return
  }
  if (message.mid && !claimMid(message.mid)) return
  if (claimGreeting(message.userId)) await reply(MAX_WELCOME)

  const media = message.attachments.filter(item => item.type && MEDIA.has(item.type))
  const client = getClient(message.userId)
  const plan = planMaxMessage(message.text, media.length > 0, Boolean(client?.dealId))

  if (plan.replyNow) {
    await reply(withDealId(plan.replyNow, client?.dealId))
    return
  }
  if (plan.open) {
    await openDeal(row.bitrixWebhookUrl, message, client?.contactId ?? null, plan.open.id, plan.attach ? media : [], token, reply)
    return
  }
  if (!plan.create && !plan.patch && !plan.attach && !plan.client) return

  if (!row.bitrixWebhookUrl) {
    await reply('Битрикс24 не подключён')
    return
  }

  const webhook = row.bitrixWebhookUrl
  const lines: string[] = []
  let dealId = client?.dealId ?? null
  try {
    const contactId = await findOrCreateMaxContact(webhook, message.userId, message.name)
    if (plan.note) lines.push(plan.note)

    if (plan.create) {
      dealId = await createMaxDeal(webhook, {
        contactId,
        title: plan.create.title,
        opportunity: plan.create.opportunity,
      })
      saveClient(message.userId, contactId, dealId)
      lines.push(plan.create.reply === 'created' ? dealCreatedReply(dealId) : WRITTEN)
    }
    if (plan.patch) {
      if (!dealId) throw new Error(NO_DEAL)
      await updateMaxDeal(webhook, dealId, plan.patch)
      lines.push(WRITTEN)
    }
    if (plan.client) {
      if (!dealId) throw new Error(NO_DEAL)
      const namedId = await findOrCreateNamedContact(webhook, plan.client.name)
      await setDealClient(webhook, dealId, namedId)
      lines.push(WRITTEN)
    }
    if (plan.attach) {
      if (!dealId) throw new Error(NO_DEAL)
      const files = await loadFiles(token, media)
      await attachFilesToDeal(webhook, dealId, files)
      lines.push(FILE_ATTACHED)
      lines.push(await dealFilesLine(webhook, dealId))
    }

    saveClient(message.userId, contactId, dealId)
    if (lines.length) await reply(withDealId(lines.join('\n'), dealId))
  }
  catch (error) {
    const messageText = failureMessage(error, 'Ошибка')
    if (!plan.create && client?.dealId && /not found/i.test(messageText)) clearDeal(message.userId)
    lines.push(messageText)
    await reply(withDealId(lines.join('\n'), dealId))
  }
}

async function openDeal(
  webhook: string | null,
  message: Incoming,
  contactId: string | null,
  dealId: string,
  media: MaxAttachment[],
  token: string,
  reply: (text: string) => unknown,
) {
  if (!webhook) {
    await reply('Битрикс24 не подключён')
    return
  }
  try {
    const form = await getMaxDealForm(webhook, dealId)
    const savedContact = contactId || await findOrCreateMaxContact(webhook, message.userId, message.name)
    const openedId = form.id || dealId
    saveClient(message.userId, savedContact, openedId)
    const lines = [dealFieldsReply({ ...form, id: openedId })]
    if (media.length) {
      const uploaded = await loadFiles(token, media)
      await attachFilesToDeal(webhook, openedId, uploaded)
      lines.push(FILE_ATTACHED)
      form.files = await getDealFiles(webhook, openedId).catch(() => form.files)
    }
    await reply(lines.join('\n'))
  }
  catch (error) {
    const messageText = failureMessage(error, 'Ошибка')
    if (/not[_\s-]*found/i.test(messageText)) {
      await reply('Сделка не найдена')
      return
    }
    await reply(messageText)
  }
}

async function dealFilesLine(webhook: string, dealId: string): Promise<string> {
  const files = await getDealFiles(webhook, dealId).catch(() => [])
  if (!files.length) return 'Файлы: —'
  return ['Файлы:', ...files.map(file => `• ${file.name}`)].join('\n')
}

async function loadFiles(token: string, attachments: MaxAttachment[]) {
  const files: { name: string, body: Buffer }[] = []
  for (const [index, attachment] of attachments.entries()) {
    let url = httpsUrl(attachment.payload?.url)
    const mediaToken = attachment.payload?.token
    if (!url && mediaToken && (attachment.type === 'video' || attachment.type === 'audio')) {
      url = await maxMediaUrl(token, attachment.type, mediaToken)
    }
    if (!url) throw new Error(`Не смог скачать вложение ${index + 1}`)
    const downloaded = await downloadMaxFile(url)
    files.push({
      name: safeFileName(
        attachment.filename || attachment.payload?.filename || attachment.payload?.name || downloaded.fileName,
        index,
        downloaded.contentType,
      ),
      body: downloaded.body,
    })
  }
  return files
}

/** message.body может быть null: апдейт — только пересланное сообщение. */
export function readMaxIncoming(update: unknown): Incoming | null {
  if (!update || typeof update !== 'object') return null
  const root = update as { update_type?: string, message?: unknown }
  if (root.update_type !== 'message_created' || !root.message || typeof root.message !== 'object') return null
  const message = root.message as {
    sender?: {
      user_id?: number
      name?: string
      username?: string
      first_name?: string
      last_name?: string
      is_bot?: boolean
    }
    recipient?: { chat_id?: number }
    timestamp?: number
    body?: MessageBody | null
    link?: LinkedMessage | null
  }
  const userIdNum = message.sender?.user_id
  if (typeof userIdNum !== 'number') return null
  const name = message.sender?.name
    || [message.sender?.first_name, message.sender?.last_name].filter(Boolean).join(' ')
    || `MAX ${userIdNum}`
  const body = message.body && typeof message.body === 'object' ? message.body : null
  const link = message.link && typeof message.link === 'object' ? message.link : null
  const own = Array.isArray(body?.attachments) ? body.attachments : []
  const forwarded = link?.type === 'forward' && Array.isArray(link.message?.attachments)
    ? link.message.attachments
    : []
  return {
    kind: 'message',
    mid: body?.mid
      || (typeof message.timestamp === 'number' ? `fwd:${message.timestamp}:${userIdNum}` : null),
    text: body?.text || '',
    chatId: typeof message.recipient?.chat_id === 'number' ? message.recipient.chat_id : null,
    userId: String(userIdNum),
    userIdNum,
    username: message.sender?.username || null,
    name,
    isBot: Boolean(message.sender?.is_bot),
    attachments: [...own, ...forwarded],
  }
}

function readStart(update: unknown): Incoming | null {
  if (!update || typeof update !== 'object') return null
  const root = update as {
    update_type?: string
    chat_id?: number
    user?: { user_id?: number, name?: string, username?: string, first_name?: string, last_name?: string, is_bot?: boolean }
  }
  if (root.update_type !== 'bot_started') return null
  const userIdNum = root.user?.user_id
  if (typeof userIdNum !== 'number') return null
  const name = root.user?.name
    || [root.user?.first_name, root.user?.last_name].filter(Boolean).join(' ')
    || `MAX ${userIdNum}`
  return {
    kind: 'start',
    mid: null,
    text: '',
    chatId: typeof root.chat_id === 'number' ? root.chat_id : null,
    userId: String(userIdNum),
    userIdNum,
    username: root.user?.username || null,
    name,
    isBot: Boolean(root.user?.is_bot),
    attachments: [],
  }
}

function httpsUrl(value: string | undefined): string | null {
  if (!value || !value.startsWith('https://')) return null
  return value
}

function safeFileName(name: string | null | undefined, index: number, contentType: string | null): string {
  const cleaned = (name || '')
    .replace(/[/\\:\0]/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120)
  const base = cleaned || `file-${index + 1}`
  if (/\.[A-Za-z0-9]{1,8}$/.test(base)) return base
  const ext = contentType ? EXT[contentType] : ''
  return ext ? `${base}${ext}` : base
}
