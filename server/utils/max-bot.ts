import type { MaxStatus } from '#shared/max-status'
import { randomInt, timingSafeEqual } from 'node:crypto'
import https from 'node:https'
import tls from 'node:tls'
import { getSettings, type MaxSettings } from './json-store'
import { RUSSIAN_TRUSTED_CAS } from './russian-trusted-cas'

export const MAX_API_BASE = 'https://platform-api2.max.ru'

const SECRET_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-'

export function makeMaxWebhookSecret(length = 32): string {
  return Array.from({ length }, () => SECRET_ALPHABET[randomInt(SECRET_ALPHABET.length)]).join('')
}

export function maxWebhookUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/max/webhook`
}

/** null — URL годится для подписки MAX. */
export function httpsWebhookProblem(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return 'Публичный адрес сервера задан некорректно (NUXT_PUBLIC_APP_URL)'
  }
  if (parsed.protocol !== 'https:') {
    return `Webhook MAX принимает только HTTPS. Сейчас ${parsed.origin}. Задайте NUXT_PUBLIC_APP_URL на публичный https-адрес.`
  }
  return null
}

/** null — пусто или входящий вебхук Битрикс24. */
export function bitrixWebhookProblem(url: string): string | null {
  const trimmed = url.trim()
  if (!trimmed) return null
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  }
  catch {
    return 'Вебхук Битрикс24 — URL вида https://портал.bitrix24.ru/rest/1/код/'
  }
  if (parsed.protocol !== 'https:') {
    return 'Вебхук Битрикс24 должен быть HTTPS'
  }
  if (!/\/rest\/\d+\/[^/]+/.test(parsed.pathname)) {
    return 'Вебхук Битрикс24 — URL вида https://портал.bitrix24.ru/rest/1/код/'
  }
  return null
}

/** База входящего вебхука, без имени метода в конце. */
export function bitrixWebhookBase(webhook: string): string {
  const parsed = new URL(webhook.trim())
  const match = parsed.pathname.match(/\/rest\/\d+\/[^/]+/)
  if (!match) return `${parsed.origin}${parsed.pathname.replace(/\/+$/, '')}/`
  return `${parsed.origin}${match[0]}/`
}

/** CRM-вебхук не имеет метода profile — проверяем чтением полей сделки. */
export function bitrixProbeUrl(webhook: string): string {
  return `${bitrixWebhookBase(webhook)}crm.deal.fields.json`
}

export function bitrixCategoryProbeUrl(webhook: string): string {
  return `${bitrixWebhookBase(webhook)}crm.dealcategory.list.json`
}

export function bitrixStatusProbeUrl(webhook: string): string {
  return `${bitrixWebhookBase(webhook)}crm.status.list.json`
}

export function resolveBitrixWebhooks(row: Pick<
  MaxSettings,
  'bitrixWebhookUrl' | 'bitrixCategoryWebhookUrl' | 'bitrixStatusWebhookUrl'
>) {
  const main = row.bitrixWebhookUrl
  return {
    main,
    category: row.bitrixCategoryWebhookUrl || main,
    status: row.bitrixStatusWebhookUrl || main,
  }
}

export function bitrixWebhookHost(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).host
  }
  catch {
    return null
  }
}

export function secretsMatch(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function failureMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'statusMessage' in error) {
    const message = (error as { statusMessage?: unknown }).statusMessage
    if (typeof message === 'string' && message) return message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

export function maxIntegrationStatus(
  row: Pick<MaxSettings,
    | 'botToken'
    | 'botName'
    | 'botUserId'
    | 'webhookUrl'
    | 'subscribedAt'
    | 'bitrixWebhookUrl'
    | 'bitrixCategoryWebhookUrl'
    | 'bitrixStatusWebhookUrl'
    | 'allowFromEnabled'
    | 'allowFrom'
  > | undefined,
  errors?: {
    tokenError?: string | null
    bitrixError?: string | null
    bitrixCategoryError?: string | null
    bitrixStatusError?: string | null
  },
): MaxStatus {
  return {
    connected: Boolean(row?.botToken && row.subscribedAt),
    botName: row?.botName ?? null,
    botUserId: row?.botUserId ?? null,
    webhookUrl: row?.webhookUrl ?? null,
    subscribedAt: row?.subscribedAt ?? null,
    bitrixWebhookHost: bitrixWebhookHost(row?.bitrixWebhookUrl),
    bitrixCategoryWebhookHost: bitrixWebhookHost(row?.bitrixCategoryWebhookUrl),
    bitrixStatusWebhookHost: bitrixWebhookHost(row?.bitrixStatusWebhookUrl),
    allowlistEnabled: Boolean(row?.allowFromEnabled),
    allowFrom: row?.allowFrom ?? '',
    tokenError: errors?.tokenError ?? null,
    bitrixError: errors?.bitrixError ?? null,
    bitrixCategoryError: errors?.bitrixCategoryError ?? null,
    bitrixStatusError: errors?.bitrixStatusError ?? null,
  }
}

export function getMaxIntegration(): MaxSettings {
  return getSettings()
}

type MaxMe = {
  user_id?: number
  name?: string
  username?: string
}

const maxCa = [...tls.rootCertificates, RUSSIAN_TRUSTED_CAS]

function maxTransportError(error: unknown): string {
  const parts: string[] = []
  let current: unknown = error
  const seen = new Set<unknown>()
  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current)
    const err = current as { message?: string, code?: string, cause?: unknown }
    const bit = [err.code, err.message].filter(Boolean).join(' ')
    if (bit && !parts.includes(bit)) parts.push(bit)
    current = err.cause
  }
  return parts.join(': ') || String(error)
}

function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {}
  if (headers instanceof Headers) return Object.fromEntries(headers.entries())
  if (Array.isArray(headers)) return Object.fromEntries(headers)
  return { ...headers }
}

type MaxHttp = { status: number, headers: Record<string, string>, body: Buffer }

/** fetch Node не доверяет Russian Trusted Root CA, которым подписан platform-api2.max.ru. */
function maxHttps(url: string, init?: RequestInit): Promise<MaxHttp> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const req = https.request({
      hostname: target.hostname,
      port: target.port || 443,
      path: `${target.pathname}${target.search}`,
      method: init?.method || 'GET',
      headers: headerRecord(init?.headers),
      ca: maxCa,
    }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (chunk: Buffer) => chunks.push(chunk))
      res.on('end', () => {
        const headers: Record<string, string> = {}
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === 'string') headers[key.toLowerCase()] = value
          else if (Array.isArray(value)) headers[key.toLowerCase()] = value.join(', ')
        }
        resolve({
          status: res.statusCode ?? 0,
          headers,
          body: Buffer.concat(chunks),
        })
      })
    })
    req.setTimeout(20_000, () => req.destroy(new Error('таймаут запроса к MAX')))
    req.on('error', reject)
    if (typeof init?.body === 'string') req.write(init.body)
    req.end()
  })
}

async function maxRequest<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let res: MaxHttp
  try {
    res = await maxHttps(`${MAX_API_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: token,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...headerRecord(init?.headers),
      },
    })
  }
  catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: `Не удалось связаться с MAX: ${maxTransportError(error)}`,
    })
  }

  const text = res.body.toString('utf8')
  if (res.status < 200 || res.status >= 300) {
    let detail = text.slice(0, 300)
    try {
      const json = JSON.parse(text) as { message?: string, error?: string }
      detail = json.message || json.error || detail
    }
    catch {
      // тело не JSON
    }
    throw createError({
      statusCode: res.status === 401 ? 400 : 502,
      statusMessage: res.status === 401
        ? 'Токен бота недействителен'
        : `MAX API: ${detail || res.status}`,
    })
  }

  if (!text) return {} as T
  return JSON.parse(text) as T
}

type BitrixCall = {
  result?: unknown
  error?: string
  error_description?: string
}

async function verifyBitrixProbe(
  webhook: string,
  probeUrl: string,
  body: Record<string, unknown>,
  rejectLabel: string,
) {
  let res: Response
  try {
    res = await fetch(probeUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    })
  }
  catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: `Не удалось связаться с Битрикс24: ${maxTransportError(error)}`,
    })
  }

  const text = await res.text()
  let parsed: BitrixCall = {}
  try {
    parsed = JSON.parse(text) as BitrixCall
  }
  catch {
    // не JSON
  }
  if (!res.ok || parsed.error || parsed.result === undefined) {
    const detail = parsed.error_description || parsed.error
    throw createError({
      statusCode: 400,
      statusMessage: detail ? `${rejectLabel}: ${detail}` : rejectLabel,
    })
  }
}

/** Входящий вебхук живой, если crm.deal.fields возвращает result. Сделку не создаёт. */
export async function verifyBitrixWebhook(webhook: string) {
  let res: Response
  try {
    res = await fetch(bitrixProbeUrl(webhook), { signal: AbortSignal.timeout(20_000) })
  }
  catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: `Не удалось связаться с Битрикс24: ${maxTransportError(error)}`,
    })
  }

  const text = await res.text()
  let body: BitrixCall = {}
  try {
    body = JSON.parse(text) as BitrixCall
  }
  catch {
    // не JSON
  }
  if (!res.ok || body.error || !body.result) {
    const detail = body.error_description || body.error
    throw createError({
      statusCode: 400,
      statusMessage: detail
        ? `Вебхук Битрикс24 не принят: ${detail}`
        : 'Вебхук Битрикс24 не принят',
    })
  }
}

export async function verifyBitrixCategoryWebhook(webhook: string) {
  await verifyBitrixProbe(
    webhook,
    bitrixCategoryProbeUrl(webhook),
    {
      order: { SORT: 'ASC' },
      filter: { IS_LOCKED: 'N' },
      select: ['ID', 'NAME'],
    },
    'Вебхук crm.dealcategory.list не принят',
  )
}

export async function verifyBitrixStatusWebhook(webhook: string) {
  await verifyBitrixProbe(
    webhook,
    bitrixStatusProbeUrl(webhook),
    {
      order: { SORT: 'ASC' },
      filter: { ENTITY_ID: 'DEAL_STAGE' },
    },
    'Вебхук crm.status.list не принят',
  )
}

export async function fetchMaxBot(token: string) {
  const me = await maxRequest<MaxMe>(token, '/me')
  return {
    userId: typeof me?.user_id === 'number' ? me.user_id : null,
    name: me?.name || me?.username || null,
  }
}

export async function subscribeMaxBot(token: string, webhookUrl: string, secret: string) {
  await maxRequest(token, '/subscriptions', {
    method: 'POST',
    body: JSON.stringify({
      url: webhookUrl,
      update_types: ['message_created', 'bot_started'],
      secret,
    }),
  })
}

export async function sendMaxMessage(
  token: string,
  target: { chatId?: number | null, userId?: number | null },
  text: string,
) {
  const params = new URLSearchParams()
  if (target.chatId != null) params.set('chat_id', String(target.chatId))
  else if (target.userId != null) params.set('user_id', String(target.userId))
  else throw new Error('Некуда ответить в MAX')
  await maxRequest(token, `/messages?${params}`, {
    method: 'POST',
    body: JSON.stringify({ text: text.slice(0, 4000) }),
  })
}

const MAX_FILE_BYTES = 20 * 1024 * 1024

/** Скачать файл по подписанной ссылке CDN. Токен бота не нужен. */
export async function downloadMaxFile(url: string): Promise<{
  body: Buffer
  fileName: string | null
  contentType: string | null
}> {
  let current = url
  for (let hop = 0; hop < 5; hop++) {
    const res = await maxHttps(current)
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.location
      if (!location) throw new Error(`редирект без Location (${res.status})`)
      current = new URL(location, current).href
      if (!current.startsWith('https:')) throw new Error('файл отдан не по HTTPS')
      continue
    }
    if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`)
    if (res.body.length > MAX_FILE_BYTES) throw new Error('файл больше 20 МБ')
    return {
      body: res.body,
      fileName: fileNameFromDisposition(res.headers['content-disposition']) || fileNameFromUrl(current),
      contentType: res.headers['content-type']?.split(';')[0]?.trim() || null,
    }
  }
  throw new Error('слишком много редиректов')
}

/** У video/audio во входящем сообщении иногда есть только token. */
export async function maxMediaUrl(
  token: string,
  kind: 'video' | 'audio',
  mediaToken: string,
): Promise<string | null> {
  const path = kind === 'video'
    ? `/videos/${encodeURIComponent(mediaToken)}`
    : `/audios/${encodeURIComponent(mediaToken)}`
  const data = await maxRequest<unknown>(token, path)
  return findHttpUrl(data, 0)
}

function findHttpUrl(value: unknown, depth: number): string | null {
  if (depth > 5 || value == null) return null
  if (typeof value === 'string') return value.startsWith('https://') ? value : null
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findHttpUrl(item, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof value === 'object') {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const found = findHttpUrl(nested, depth + 1)
      if (found) return found
    }
  }
  return null
}

function fileNameFromDisposition(header: string | undefined): string | null {
  if (!header) return null
  const star = /filename\*=(?:UTF-8''|utf-8'')([^;]+)/i.exec(header)
  if (star?.[1]) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
    }
    catch {
      return star[1].trim()
    }
  }
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() || null
}

function fileNameFromUrl(url: string): string | null {
  try {
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop() || '')
    if (!name || name === '/') return null
    return name
  }
  catch {
    return null
  }
}
