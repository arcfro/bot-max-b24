import { createHmac, timingSafeEqual } from 'node:crypto'

const MAX_AGE_SEC = 60 * 60

export type MaxInitUser = {
  userId: string
  name: string
  username: string | null
}

/** Проверяет window.WebApp.initData. null — подпись, срок или user не сходятся. */
export function readMaxInitData(initData: string, botToken: string, nowSec: number): MaxInitUser | null {
  const raw = initData.trim()
  if (!raw || !botToken) return null
  const pairs: [string, string][] = []
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=')
    if (eq <= 0) return null
    pairs.push([part.slice(0, eq), part.slice(eq + 1)])
  }
  if (pairs.filter(pair => pair[0] === 'hash').length !== 1) return null
  for (const pair of pairs) {
    try {
      pair[1] = decodeURIComponent(pair[1].replace(/\+/g, ' '))
    }
    catch {
      return null
    }
  }
  pairs.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)
  const hash = pairs.find(pair => pair[0] === 'hash')?.[1] ?? ''
  const launch = pairs.filter(pair => pair[0] !== 'hash').map(pair => `${pair[0]}=${pair[1]}`).join('\n')
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const expected = createHmac('sha256', secret).update(launch).digest('hex')
  const left = Buffer.from(expected)
  const right = Buffer.from(hash)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null

  const fields = Object.fromEntries(pairs)
  const authDate = Number(fields.auth_date)
  if (!Number.isFinite(authDate)) return null
  if (nowSec - authDate > MAX_AGE_SEC || authDate > nowSec + 60) return null

  let user: { id?: unknown, first_name?: unknown, last_name?: unknown, username?: unknown }
  try {
    user = JSON.parse(String(fields.user || ''))
  }
  catch {
    return null
  }
  if (typeof user.id !== 'number' || !Number.isSafeInteger(user.id)) return null
  const first = typeof user.first_name === 'string' ? user.first_name : ''
  const last = typeof user.last_name === 'string' ? user.last_name : ''
  const username = typeof user.username === 'string' ? user.username : ''
  const name = [first, last].filter(Boolean).join(' ') || username || `MAX ${user.id}`
  return { userId: String(user.id), name, username: username || null }
}
