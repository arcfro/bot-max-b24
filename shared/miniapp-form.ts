import { parseCategoryId } from './miniapp-id'
import { EMPTY_TITLE, NO_DEAL, planMaxMessage } from './max-commands'

export const EMPTY_FORM = 'Нечего записывать'
export const BAD_CATEGORY = 'Некорректная воронка'

export type MiniappForm = {
  title: string
  amount: string
  begin: string
  close: string
  client: string
  categoryId: string
  loadedCategoryId: string
  hasFile: boolean
}

export type MiniappPlan = {
  error?: string
  create?: { title: string, opportunity?: number, categoryId?: string }
  patch?: { title?: string, opportunity?: number, begin?: string, close?: string, categoryId?: string }
  client?: { name: string }
  attach?: true
}

/** Поля экрана /miniapp. Название создаёт сделку или обновляет TITLE. `forceNew` — всегда новая, даже если активная уже есть. */
export function planMiniappForm(form: MiniappForm, hasDeal: boolean, forceNew = false): MiniappPlan {
  const title = form.title.trim()
  const amount = form.amount.trim()
  const begin = form.begin.trim()
  const close = form.close.trim()
  const client = form.client.trim()
  const categoryId = parseCategoryId(form.categoryId)
  const loadedCategoryId = parseCategoryId(form.loadedCategoryId)
  if (form.categoryId.trim() && categoryId == null) return { error: BAD_CATEGORY }
  if (forceNew && !title) return { error: EMPTY_TITLE }
  const active = forceNew ? false : hasDeal
  const categoryChanged = active && categoryId != null && loadedCategoryId != null && categoryId !== loadedCategoryId
  if (!title && !amount && !begin && !close && !client && !form.hasFile && !categoryChanged) {
    return { error: EMPTY_FORM }
  }

  const amountPlan = amount ? planMaxMessage(`С: ${amount}`, false, true) : null
  if (amountPlan?.replyNow) return { error: amountPlan.replyNow }
  const beginPlan = begin ? planMaxMessage(`Дн: ${begin}`, false, true) : null
  if (beginPlan?.replyNow) return { error: beginPlan.replyNow }
  const closePlan = close ? planMaxMessage(`Дз: ${close}`, false, true) : null
  if (closePlan?.replyNow) return { error: closePlan.replyNow }
  const clientPlan = client ? planMaxMessage(`К: ${client}`, false, true) : null
  if (clientPlan?.replyNow) return { error: clientPlan.replyNow }

  const opportunity = amountPlan?.patch?.opportunity
  const willHaveDeal = active || Boolean(title) || opportunity != null
  if ((begin || close || client || form.hasFile) && !willHaveDeal) return { error: NO_DEAL }

  const plan: MiniappPlan = {}
  if (title && !active) plan.create = { title, ...(categoryId != null ? { categoryId } : {}) }
  if (opportunity != null && !active && !title) {
    plan.create = { title: amount, opportunity, ...(categoryId != null ? { categoryId } : {}) }
  }
  if (opportunity != null && plan.create) plan.create.opportunity = opportunity
  if (categoryId != null && plan.create && plan.create.categoryId == null) plan.create.categoryId = categoryId

  const patch: NonNullable<MiniappPlan['patch']> = {}
  if (title && active) patch.title = title
  if (opportunity != null && !plan.create) patch.opportunity = opportunity
  if (beginPlan?.patch?.begin) patch.begin = beginPlan.patch.begin
  if (closePlan?.patch?.close) patch.close = closePlan.patch.close
  if (categoryChanged && categoryId != null) patch.categoryId = categoryId
  if (Object.keys(patch).length) plan.patch = patch
  if (clientPlan?.client?.name) plan.client = { name: clientPlan.client.name }
  if (form.hasFile) plan.attach = true
  return plan
}
