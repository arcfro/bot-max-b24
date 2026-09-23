export type DealFile = {
  id: string
  name: string
  created: string
}

export type DealForm = {
  id: string | null
  title: string
  amount: string
  begin: string
  close: string
  client: string
  files: DealFile[]
}

export type DealResponse = DealForm & { message?: string, revision?: number }

export type RevisionResponse = { dealId: string | null, updatedAt: number }

export function dealFileDate(raw: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw ?? '').trim())
  return match?.[1] ?? ''
}

/** `{commentId}:{fileName}` из filesFromTimelineComments. */
export function parseDealFileId(raw: string): { commentId: string, name: string } | null {
  const idx = raw.indexOf(':')
  if (idx <= 0) return null
  const commentId = raw.slice(0, idx)
  const name = raw.slice(idx + 1)
  if (!/^\d+$/.test(commentId) || !name) return null
  return { commentId, name }
}

const MAX_FILE_PREFIX = 'Файл из MAX'

const empty: DealForm = {
  id: null,
  title: '',
  amount: '',
  begin: '',
  close: '',
  client: '',
  files: [],
}

/** Поля crm.deal.get → инпуты экрана. Дата обрезается до ГГГГ-ММ-ДД, сумма без хвостовых нулей. */
export function formFromDeal(deal: {
  id?: string | number | null
  title?: string | null
  opportunity?: string | number | null
  begin?: string | null
  close?: string | null
  client?: string | null
} | null): DealForm {
  if (!deal || deal.id == null || deal.id === '') return { ...empty }
  return {
    id: String(deal.id),
    title: String(deal.title ?? ''),
    amount: amountInput(deal.opportunity),
    begin: dateInput(deal.begin),
    close: dateInput(deal.close),
    client: String(deal.client ?? '').trim(),
    files: [],
  }
}

function dateInput(raw: string | null | undefined): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(String(raw ?? '').trim())
  return match?.[1] ?? ''
}

function amountInput(raw: string | number | null | undefined): string {
  if (raw == null || raw === '') return ''
  const value = Number(String(raw).replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(value) ? String(value) : ''
}

type TimelineComment = {
  ID?: string | number
  CREATED?: string | null
  COMMENT?: string | null
  FILES?: Record<string, {
    id?: string | number
    name?: string | null
    date?: string | null
  }> | null
}

function fileNamesFromFilesField(files: TimelineComment['FILES']): string[] {
  if (!files || typeof files !== 'object') return []
  const values = Array.isArray(files) ? files : Object.values(files)
  const names: string[] = []
  for (const file of values) {
    if (Array.isArray(file)) {
      const name = String(file[0] ?? '').trim()
      if (name) names.push(name)
      continue
    }
    if (!file || typeof file !== 'object') continue
    const name = String(file.name ?? '').trim()
    if (name) names.push(name)
  }
  return names
}

function fileNamesFromComment(text: string): string[] {
  const idx = text.indexOf(MAX_FILE_PREFIX)
  if (idx < 0) return []
  return text
    .slice(idx + MAX_FILE_PREFIX.length)
    .replace(/^:\s*/, '')
    .split(',')
    .map(part => part.trim())
    .filter(Boolean)
}

/** Файлы из комментариев таймлайна с префиксом «Файл из MAX». */
export function filesFromTimelineComments(comments: TimelineComment[]): DealFile[] {
  const out: DealFile[] = []
  for (const comment of comments) {
    const text = String(comment.COMMENT ?? '').trim()
    if (!text.includes(MAX_FILE_PREFIX)) continue
    const created = String(comment.CREATED ?? '')
    const names = fileNamesFromFilesField(comment.FILES)
    const resolved = names.length ? names : fileNamesFromComment(text)
    for (const name of resolved) {
      out.push({
        id: `${comment.ID ?? '0'}:${name}`,
        name,
        created,
      })
    }
  }
  return out.sort((a, b) => b.created.localeCompare(a.created))
}
