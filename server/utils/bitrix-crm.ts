import { filesFromTimelineComments, formFromDeal, type DealFile, type DealForm } from '#shared/miniapp-deal'
import { bitrixWebhookBase } from './max-bot'

type BitrixResponse<T> = {
  result?: T
  error?: string
  error_description?: string
}

export async function bitrixCall<T>(
  webhook: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const url = `${bitrixWebhookBase(webhook)}${method}.json`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25_000),
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Не удалось связаться с Битрикс24: ${message}`)
  }

  const text = await res.text()
  let json: BitrixResponse<T> = {}
  try {
    json = JSON.parse(text) as BitrixResponse<T>
  }
  catch {
    // не JSON
  }
  if (!res.ok || json.error || json.result === undefined) {
    throw new Error(json.error_description || json.error || `Битрикс24: HTTP ${res.status}`)
  }
  return json.result
}

function asId(id: string): number | string {
  if (/^\d+$/.test(id)) {
    const numeric = Number(id)
    if (Number.isSafeInteger(numeric)) return numeric
  }
  return id
}

/** Контакт с ORIGINATOR_ID=max и ORIGIN_ID=userId, иначе новый. */
export async function findOrCreateMaxContact(webhook: string, userId: string, name: string): Promise<string> {
  const list = await bitrixCall<Array<{
    ID?: string | number
    ORIGIN_ID?: string | number | null
    ORIGINATOR_ID?: string | null
  }>>(webhook, 'crm.contact.list', {
    filter: { '=ORIGINATOR_ID': 'max', '=ORIGIN_ID': userId },
    select: ['ID', 'ORIGIN_ID', 'ORIGINATOR_ID'],
  })
  const existing = (Array.isArray(list) ? list : []).find(row =>
    String(row.ORIGINATOR_ID ?? '') === 'max' && String(row.ORIGIN_ID ?? '') === userId,
  )?.ID
  if (existing != null && String(existing) !== '') return String(existing)

  const parts = name.trim().split(/\s+/).filter(Boolean)
  const id = await bitrixCall<number | string>(webhook, 'crm.contact.add', {
    fields: {
      NAME: parts[0] || `MAX ${userId}`,
      LAST_NAME: parts.slice(1).join(' '),
      ORIGINATOR_ID: 'max',
      ORIGIN_ID: userId,
      SOURCE_DESCRIPTION: 'MAX',
      OPENED: 'Y',
    },
  })
  return String(id)
}

export async function createMaxDeal(
  webhook: string,
  input: { contactId: string, title: string, opportunity?: number },
): Promise<string> {
  const fields: Record<string, unknown> = {
    TITLE: input.title.slice(0, 255),
    CONTACT_ID: asId(input.contactId),
  }
  if (input.opportunity != null) fields.OPPORTUNITY = input.opportunity
  const id = await bitrixCall<number | string>(webhook, 'crm.deal.add', { fields })
  return String(id)
}

/** Контакт по имени. Одно слово ищет только с пустой фамилией, чтобы не схватить однофамильца. */
export async function findOrCreateNamedContact(webhook: string, fullName: string): Promise<string> {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] || fullName.trim()
  const last = parts.slice(1).join(' ')
  const list = await bitrixCall<Array<{
    ID?: string | number
    NAME?: string | null
    LAST_NAME?: string | null
  }>>(webhook, 'crm.contact.list', {
    filter: last ? { '=NAME': first, '=LAST_NAME': last } : { '=NAME': first },
    select: ['ID', 'NAME', 'LAST_NAME'],
  })
  const existing = (Array.isArray(list) ? list : []).find((row) => {
    const sameFirst = String(row.NAME ?? '').trim().toLowerCase() === first.toLowerCase()
    const sameLast = String(row.LAST_NAME ?? '').trim().toLowerCase() === last.toLowerCase()
    return sameFirst && sameLast
  })?.ID
  if (existing != null && String(existing) !== '') return String(existing)

  const id = await bitrixCall<number | string>(webhook, 'crm.contact.add', {
    fields: {
      NAME: first,
      LAST_NAME: last,
      OPENED: 'Y',
    },
  })
  return String(id)
}

/** Поле «Клиент» сделки — основной контакт. */
export async function setDealClient(webhook: string, dealId: string, contactId: string) {
  await bitrixCall(webhook, 'crm.deal.contact.items.set', {
    id: asId(dealId),
    items: [{ CONTACT_ID: asId(contactId), IS_PRIMARY: 'Y' }],
  })
}

export async function getMaxDeal(webhook: string, dealId: string): Promise<{ id: string, title: string }> {
  const form = await getMaxDealForm(webhook, dealId)
  return { id: form.id || dealId, title: form.title }
}

export async function getDealFiles(webhook: string, dealId: string): Promise<DealFile[]> {
  const list = await bitrixCall<Array<{
    ID?: string | number
    CREATED?: string | null
    COMMENT?: string | null
    FILES?: Record<string, {
      id?: string | number
      name?: string | null
      date?: string | null
    }> | null
  }>>(webhook, 'crm.timeline.comment.list', {
    filter: { ENTITY_ID: asId(dealId), ENTITY_TYPE: 'deal' },
    select: ['ID', 'CREATED', 'COMMENT', 'FILES'],
    order: { CREATED: 'DESC' },
  })
  return filesFromTimelineComments(Array.isArray(list) ? list : [])
}

export async function getMaxDealForm(webhook: string, dealId: string): Promise<DealForm> {
  const deal = await bitrixCall<{
    ID?: string | number
    TITLE?: string | null
    OPPORTUNITY?: string | number | null
    BEGINDATE?: string | null
    CLOSEDATE?: string | null
    CONTACT_ID?: string | number | null
  }>(webhook, 'crm.deal.get', { id: asId(dealId) })
  const contactId = deal.CONTACT_ID
  const clientPromise = (async () => {
    if (contactId == null || String(contactId) === '' || String(contactId) === '0') return ''
    try {
      const contact = await bitrixCall<{ NAME?: string | null, LAST_NAME?: string | null }>(
        webhook,
        'crm.contact.get',
        { id: asId(String(contactId)) },
      )
      return [contact.NAME, contact.LAST_NAME].map(part => String(part ?? '').trim()).filter(Boolean).join(' ')
    }
    catch {
      return ''
    }
  })()
  const [client, files] = await Promise.all([
    clientPromise,
    getDealFiles(webhook, dealId),
  ])
  return {
    ...formFromDeal({
      id: deal.ID ?? dealId,
      title: deal.TITLE,
      opportunity: deal.OPPORTUNITY,
      begin: deal.BEGINDATE,
      close: deal.CLOSEDATE,
      client,
    }),
    files,
  }
}

export async function updateMaxDeal(
  webhook: string,
  dealId: string,
  patch: { title?: string, opportunity?: number, begin?: string, close?: string },
) {
  const fields: Record<string, unknown> = {}
  if (patch.title) fields.TITLE = patch.title.slice(0, 255)
  if (patch.opportunity != null) fields.OPPORTUNITY = patch.opportunity
  if (patch.begin) fields.BEGINDATE = patch.begin
  if (patch.close) fields.CLOSEDATE = patch.close
  await bitrixCall(webhook, 'crm.deal.update', { id: asId(dealId), fields })
}

export async function attachFilesToDeal(
  webhook: string,
  dealId: string,
  files: { name: string, body: Buffer }[],
) {
  await bitrixCall(webhook, 'crm.timeline.comment.add', {
    fields: {
      ENTITY_ID: asId(dealId),
      ENTITY_TYPE: 'deal',
      COMMENT: `Файл из MAX: ${files.map(file => file.name).join(', ')}`,
      FILES: files.map(file => [file.name, file.body.toString('base64')]),
    },
  })
}
