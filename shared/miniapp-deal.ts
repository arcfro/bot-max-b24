export type DealForm = {
  id: string | null
  title: string
  amount: string
  begin: string
  close: string
  client: string
}

const empty: DealForm = {
  id: null,
  title: '',
  amount: '',
  begin: '',
  close: '',
  client: '',
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
