export const MAX_HELP = [
  'Команды:',
  'Н: или Новая: название — новая сделка',
  'С: или Сумма: число — сумма текущей сделки (если сделки нет, создаст её)',
  'Дн: или Д1: или Дата начала: ДД.ММ.ГГГГ',
  'Дз: или Д2: или Дата завершения: ДД.ММ.ГГГГ',
  'К: или Клиент: имя — клиент сделки, контакт создаётся если его нет',
  'ID: число — открыть сделку и показать поля',
  'Файл — прикрепить к текущей сделке',
  '? или / — эта подсказка',
].join('\n')

export const WRITTEN = 'Записано'
export const FILE_ATTACHED = 'Файл прикреплён'
export const NO_DEAL = 'Нет активной сделки. Сначала отправьте Н: название'
export const UNKNOWN_COMMAND = `Не понял команду.\n${MAX_HELP}`
export const MAX_DENIED = 'Нет прав писать в этот бот.'
export const MAX_WELCOME = `Здравствуйте.\n${MAX_HELP}`
export const EMPTY_TITLE = 'Пустое название'
export const EMPTY_CLIENT = 'Пустое имя клиента'
export const BAD_AMOUNT = 'Сумма должна быть числом'
export const BAD_DATE = 'Дата должна быть в виде ДД.ММ.ГГГГ'
export const BAD_ID = 'ID сделки — число'

export function dealCreatedReply(id: string | number): string {
  return `Сделка создана №:${id}`
}

/** Поля открытой сделки в том же виде, что команды. */
export function dealFieldsReply(form: {
  id: string | null
  title: string
  amount: string
  begin: string
  close: string
  client: string
}): string {
  return [
    `№:${form.id ?? ''}`,
    `Н: ${form.title}`,
    `С: ${form.amount}`,
    `Дн: ${isoToRu(form.begin)}`,
    `Дз: ${isoToRu(form.close)}`,
    `К: ${form.client}`,
  ].join('\n')
}

function isoToRu(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim())
  if (!match) return iso
  return `${match[3]}.${match[2]}.${match[1]}`
}

/** Дописывает № сделки, если в тексте его ещё нет. */
export function withDealId(text: string, id: string | number | null | undefined): string {
  if (id == null || id === '') return text
  const mark = `№:${id}`
  if (text.includes(mark)) return text
  return `${text} ${mark}`
}

type Plan = {
  replyNow?: string
  open?: { id: string }
  create?: { title: string, opportunity?: number, reply: 'created' | 'written' }
  patch?: { opportunity?: number, begin?: string, close?: string }
  client?: { name: string }
  attach?: true
  note?: string
}

const COMMANDS = [
  { prefix: 'дата завершения:', kind: 'close' },
  { prefix: 'дата начала:', kind: 'begin' },
  { prefix: 'новая:', kind: 'new' },
  { prefix: 'клиент:', kind: 'client' },
  { prefix: 'сумма:', kind: 'amount' },
  { prefix: 'дн:', kind: 'begin' },
  { prefix: 'дз:', kind: 'close' },
  { prefix: 'д1:', kind: 'begin' },
  { prefix: 'д2:', kind: 'close' },
  { prefix: 'н:', kind: 'new' },
  { prefix: 'к:', kind: 'client' },
  { prefix: 'с:', kind: 'amount' },
  { prefix: 'id:', kind: 'open' },
] as const

/** Что сделать с текстом MAX. `hasDeal` — есть запомненная сделка этого пользователя. */
export function planMaxMessage(text: string, hasFiles: boolean, hasDeal: boolean): Plan {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()
  if (lower === '?' || lower === '/') return { replyNow: MAX_HELP }
  if (!trimmed && !hasFiles) return {}

  const command = matchCommand(trimmed)
  if (command && 'error' in command) return { replyNow: command.error }

  if (command?.kind === 'open') {
    return withAttach({ open: { id: command.id } }, hasFiles)
  }
  if (command?.kind === 'new') {
    return withAttach({ create: { title: command.title, reply: 'created' } }, hasFiles)
  }
  if (command?.kind === 'amount') {
    const create = {
      title: command.title,
      opportunity: command.amount,
      reply: 'written' as const,
    }
    if (!hasDeal) return withAttach({ create }, hasFiles)
    return withAttach({ patch: { opportunity: command.amount } }, hasFiles)
  }
  if (command?.kind === 'begin' || command?.kind === 'close') {
    if (!hasDeal) return { replyNow: NO_DEAL }
    const patch = command.kind === 'begin'
      ? { begin: command.iso }
      : { close: command.iso }
    return withAttach({ patch }, hasFiles)
  }
  if (command?.kind === 'client') {
    if (!hasDeal) return { replyNow: NO_DEAL }
    return withAttach({ client: { name: command.name } }, hasFiles)
  }

  if (hasFiles && !trimmed) {
    if (!hasDeal) return { replyNow: NO_DEAL }
    return { attach: true }
  }
  if (hasFiles && hasDeal) return { attach: true, note: UNKNOWN_COMMAND }
  if (hasFiles) return { replyNow: `${UNKNOWN_COMMAND}\n${NO_DEAL}` }
  return { replyNow: UNKNOWN_COMMAND }
}

function withAttach(plan: Plan, hasFiles: boolean): Plan {
  if (!hasFiles) return plan
  return { ...plan, attach: true }
}

function matchCommand(text: string):
  | { kind: 'open', id: string }
  | { kind: 'new', title: string }
  | { kind: 'amount', title: string, amount: number }
  | { kind: 'begin', iso: string }
  | { kind: 'close', iso: string }
  | { kind: 'client', name: string }
  | { error: string }
  | null {
  const lower = text.toLowerCase()
  const rule = COMMANDS.find(item => lower.startsWith(item.prefix))
  if (!rule) return null
  const value = text.slice(rule.prefix.length).trim()
  if (rule.kind === 'open') {
    if (!/^\d+$/.test(value)) return { error: BAD_ID }
    return { kind: 'open', id: value }
  }
  if (rule.kind === 'new') {
    if (!value) return { error: EMPTY_TITLE }
    return { kind: 'new', title: value }
  }
  if (rule.kind === 'amount') {
    const amount = parseAmount(value)
    if (amount == null) return { error: BAD_AMOUNT }
    return { kind: 'amount', title: value, amount }
  }
  if (rule.kind === 'client') {
    if (!value) return { error: EMPTY_CLIENT }
    return { kind: 'client', name: value }
  }
  const iso = parseRuDate(value)
  if (!iso) return { error: BAD_DATE }
  return rule.kind === 'begin' ? { kind: 'begin', iso } : { kind: 'close', iso }
}

function parseAmount(raw: string): number | null {
  const normalized = raw.trim().replace(/[\s\u00a0]/g, '').replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null
  const value = Number(normalized)
  return Number.isFinite(value) ? value : null
}

/** ДД.ММ.ГГГГ, ДД.ММ.ГГ или ГГГГ-ММ-ДД. Несуществующий день — null. */
export function parseRuDate(raw: string): string | null {
  const source = raw.trim()
  let year = 0
  let month = 0
  let day = 0
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(source)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(source)
  if (dotted) {
    day = Number(dotted[1])
    month = Number(dotted[2])
    year = Number(dotted[3])
    if (year < 100) year += 2000
  }
  else if (iso) {
    year = Number(iso[1])
    month = Number(iso[2])
    day = Number(iso[3])
  }
  else {
    return null
  }
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** id или @username, через запятую, пробел или перевод строки. Ссылка max.ru/name тоже годится. */
export function parseMaxAllowList(raw: string): string[] {
  const seen = new Set<string>()
  const accounts: string[] = []
  for (const part of raw.split(/[\s,;]+/)) {
    const key = normalizeMaxAccount(part)
    if (!key || seen.has(key)) continue
    seen.add(key)
    accounts.push(key)
  }
  return accounts
}

export function maxSenderAllowed(
  enabled: boolean,
  raw: string,
  sender: { userId: string, username?: string | null },
): boolean {
  if (!enabled) return true
  const keys = new Set(parseMaxAllowList(raw))
  if (keys.has(sender.userId.trim().toLowerCase())) return true
  const username = sender.username ? normalizeMaxAccount(sender.username) : ''
  return Boolean(username && keys.has(username))
}

function normalizeMaxAccount(raw: string): string {
  let value = raw.trim()
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname.split('/').filter(Boolean).pop() || value
    }
    catch {
      // оставляем как есть
    }
  }
  return value.replace(/^@+/, '').trim().toLowerCase()
}
