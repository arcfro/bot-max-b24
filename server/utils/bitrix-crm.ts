import {
  filesFromTimelineComments,
  formFromDeal,
  parseDealFileId,
  type DealCategory,
  type DealFile,
  type DealForm,
  type DealStage,
} from '#shared/miniapp-deal'
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

const DEAL_ENTITY_TYPE_ID = 2

function stageEntityId(categoryId: string): string {
  const id = Number(categoryId)
  return Number.isFinite(id) && id > 0 ? `DEAL_STAGE_${id}` : 'DEAL_STAGE'
}

async function listDealCategoriesModern(webhook: string): Promise<DealCategory[]> {
  const data = await bitrixCall<unknown>(webhook, 'crm.category.list', { entityTypeId: DEAL_ENTITY_TYPE_ID })
  return normalizeDealCategoryRows(
    data && typeof data === 'object' && 'categories' in data ? data : { categories: data },
  )
}

async function listDealCategoriesLegacy(webhook: string): Promise<DealCategory[]> {
  const rows = await bitrixCall<unknown>(webhook, 'crm.dealcategory.list', {
    order: { SORT: 'ASC' },
    filter: { IS_LOCKED: 'N' },
    select: ['ID', 'NAME'],
  })
  return normalizeDealCategoryRows(rows)
}

function normalizeDealCategoryRows(rows: unknown): DealCategory[] {
  const list = Array.isArray(rows)
    ? rows
    : rows && typeof rows === 'object' && Array.isArray((rows as { categories?: unknown }).categories)
      ? (rows as { categories: Array<{ id?: number | string, ID?: number | string, name?: string | null, NAME?: string | null }> }).categories
      : []
  return list
    .map((row) => {
      const id = row.id ?? row.ID
      const name = row.name ?? row.NAME
      return {
        id: String(id ?? ''),
        name: String(name ?? '').trim() || `Воронка ${id ?? ''}`,
      }
    })
    .filter(row => row.id !== '')
    .sort((a, b) => Number(a.id) - Number(b.id))
}

/** Список воронок. Отдельный вебхук проверяется через crm.dealcategory.list. */
export async function listDealCategories(webhook: string, preferLegacy = false): Promise<DealCategory[]> {
  const attempts = preferLegacy
    ? [listDealCategoriesLegacy, listDealCategoriesModern]
    : [listDealCategoriesModern, listDealCategoriesLegacy]
  let lastError: unknown
  for (const attempt of attempts) {
    try {
      const list = await attempt(webhook)
      if (list.length) return list
    }
    catch (error) {
      lastError = error
    }
  }
  if (lastError instanceof Error) throw lastError
  return []
}

export async function listDealStages(webhook: string, categoryId: string): Promise<DealStage[]> {
  const rows = await bitrixCall<Array<{
    STATUS_ID?: string
    NAME?: string | null
  }>>(webhook, 'crm.status.list', {
    order: { SORT: 'ASC' },
    filter: { ENTITY_ID: stageEntityId(categoryId) },
  })
  const list = Array.isArray(rows) ? rows : []
  return list
    .filter(row => row.STATUS_ID)
    .map(row => ({
      id: String(row.STATUS_ID),
      name: String(row.NAME ?? '').trim() || String(row.STATUS_ID),
    }))
}

export async function firstProcessStage(webhook: string, categoryId: string): Promise<string> {
  const rows = await bitrixCall<Array<{
    STATUS_ID?: string
    EXTRA?: { SEMANTICS?: string | null }
  }>>(webhook, 'crm.status.list', {
    order: { SORT: 'ASC' },
    filter: { ENTITY_ID: stageEntityId(categoryId) },
  })
  const list = Array.isArray(rows) ? rows : []
  const process = list.find(stage => stage.EXTRA?.SEMANTICS === 'process')
  const stageId = process?.STATUS_ID ?? list[0]?.STATUS_ID
  if (!stageId) throw new Error('Нет стадий в воронке')
  return stageId
}

type BitrixDealHooks = { statusWebhook?: string }

export async function createMaxDeal(
  webhook: string,
  input: { contactId: string, title: string, opportunity?: number, categoryId?: string },
  hooks?: BitrixDealHooks,
): Promise<string> {
  const statusWebhook = hooks?.statusWebhook ?? webhook
  const fields: Record<string, unknown> = {
    TITLE: input.title.slice(0, 255),
    CONTACT_ID: asId(input.contactId),
  }
  if (input.opportunity != null) fields.OPPORTUNITY = input.opportunity
  if (input.categoryId != null && input.categoryId !== '') {
    fields.CATEGORY_ID = Number(input.categoryId)
    fields.STAGE_ID = await firstProcessStage(statusWebhook, input.categoryId)
  }
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

type TimelineCommentRow = {
  ID?: string | number
  CREATED?: string | null
  COMMENT?: string | null
  FILES?: Record<string, {
    id?: string | number
    name?: string | null
    date?: string | null
  }> | Array<string | [string, string]> | null
}

export async function getDealFiles(webhook: string, dealId: string): Promise<DealFile[]> {
  const comments: TimelineCommentRow[] = []
  let start = 0
  while (true) {
    const page = await bitrixCall<TimelineCommentRow[]>(webhook, 'crm.timeline.comment.list', {
      filter: { ENTITY_ID: asId(dealId), ENTITY_TYPE: 'deal' },
      select: ['ID', 'CREATED', 'COMMENT', 'FILES'],
      order: { CREATED: 'DESC' },
      start,
    })
    const batch = Array.isArray(page) ? page : []
    comments.push(...batch)
    if (batch.length < 50) break
    start += 50
  }
  return filesFromTimelineComments(comments)
}

export async function getMaxDealForm(webhook: string, dealId: string): Promise<DealForm> {
  const deal = await bitrixCall<{
    ID?: string | number
    TITLE?: string | null
    OPPORTUNITY?: string | number | null
    BEGINDATE?: string | null
    CLOSEDATE?: string | null
    CONTACT_ID?: string | number | null
    CATEGORY_ID?: string | number | null
    STAGE_ID?: string | null
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
    getDealFiles(webhook, dealId).catch(() => [] as DealFile[]),
  ])
  return {
    ...formFromDeal({
      id: deal.ID ?? dealId,
      title: deal.TITLE,
      opportunity: deal.OPPORTUNITY,
      begin: deal.BEGINDATE,
      close: deal.CLOSEDATE,
      client,
      categoryId: deal.CATEGORY_ID,
      stageId: deal.STAGE_ID,
    }),
    files,
  }
}

export async function updateMaxDeal(
  webhook: string,
  dealId: string,
  patch: {
    title?: string
    opportunity?: number
    begin?: string
    close?: string
    categoryId?: string
    stageId?: string
  },
  hooks?: BitrixDealHooks,
) {
  const statusWebhook = hooks?.statusWebhook ?? webhook
  const fields: Record<string, unknown> = {}
  if (patch.title) fields.TITLE = patch.title.slice(0, 255)
  if (patch.opportunity != null) fields.OPPORTUNITY = patch.opportunity
  if (patch.begin) fields.BEGINDATE = patch.begin
  if (patch.close) fields.CLOSEDATE = patch.close
  if (patch.categoryId != null) {
    fields.CATEGORY_ID = Number(patch.categoryId)
    fields.STAGE_ID = await firstProcessStage(statusWebhook, patch.categoryId)
  }
  else if (patch.stageId != null) {
    fields.STAGE_ID = patch.stageId
  }
  await bitrixCall(webhook, 'crm.deal.update', { id: asId(dealId), fields })
}

const DEAL_OWNER_TYPE_ID = 2

export async function deleteDealFile(webhook: string, dealId: string, fileId: string) {
  const parsed = parseDealFileId(fileId)
  if (!parsed) throw new Error('Некорректный файл')

  const comment = await bitrixCall<{
    ID?: string | number
    ENTITY_ID?: string | number
    ENTITY_TYPE?: string | null
    COMMENT?: string | null
    CREATED?: string | null
    FILES?: TimelineCommentRow['FILES']
  }>(webhook, 'crm.timeline.comment.get', { id: asId(parsed.commentId) })

  if (String(comment.ENTITY_TYPE ?? '') !== 'deal') throw new Error('Файл не найден')
  if (String(comment.ENTITY_ID ?? '') !== String(dealId)) throw new Error('Файл не найден')
  if (!String(comment.COMMENT ?? '').includes('Файл из MAX')) throw new Error('Файл не найден')

  const known = filesFromTimelineComments([{
    ID: parsed.commentId,
    CREATED: comment.CREATED,
    COMMENT: comment.COMMENT,
    FILES: comment.FILES,
  }])
  if (!known.some(file => file.id === fileId)) throw new Error('Файл не найден')

  await bitrixCall<null>(webhook, 'crm.timeline.comment.delete', {
    id: asId(parsed.commentId),
    ownerTypeId: DEAL_OWNER_TYPE_ID,
    ownerId: asId(dealId),
  })
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
