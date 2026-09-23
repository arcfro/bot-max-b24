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

/** Файлы из комментариев таймлайна с префиксом «Файл из MAX». */
export function filesFromTimelineComments(comments: TimelineComment[]): DealFile[] {
  const out: DealFile[] = []
  for (const comment of comments) {
    if (!String(comment.COMMENT ?? '').startsWith(MAX_FILE_PREFIX)) continue
    const attached = comment.FILES
    if (!attached || typeof attached !== 'object') continue
    for (const file of Object.values(attached)) {
      const name = String(file?.name ?? '').trim()
      if (!name) continue
      out.push({
        id: `${comment.ID ?? '0'}:${file?.id ?? name}`,
        name,
        created: String(file?.date ?? comment.CREATED ?? ''),
      })
    }
  }
  return out.sort((a, b) => b.created.localeCompare(a.created))
}
