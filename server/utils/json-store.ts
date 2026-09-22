import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type MaxSettings = {
  botToken: string | null
  webhookSecret: string | null
  webhookUrl: string | null
  botUserId: number | null
  botName: string | null
  bitrixWebhookUrl: string | null
  allowFromEnabled: boolean
  allowFrom: string
  subscribedAt: number | null
  updatedAt: number
}

export type MaxClient = {
  contactId: string
  dealId: string | null
  updatedAt: number
}

export type MaxState = {
  clients: Record<string, MaxClient>
  greeted: Record<string, number>
  seen: Record<string, number>
}

const SEEN_TTL_MS = 30 * 24 * 60 * 60 * 1000

function dataDir(): string {
  try {
    const fromConfig = useRuntimeConfig()?.dataDir
    if (fromConfig) return String(fromConfig)
  }
  catch {
    // вне Nitro (vitest)
  }
  return process.env.DATA_DIR || './data'
}

function settingsPath() {
  return join(dataDir(), 'settings.json')
}

function statePath() {
  return join(dataDir(), 'state.json')
}

function ensureDir() {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function defaultSettings(): MaxSettings {
  return {
    botToken: null,
    webhookSecret: null,
    webhookUrl: null,
    botUserId: null,
    botName: null,
    bitrixWebhookUrl: null,
    allowFromEnabled: false,
    allowFrom: '',
    subscribedAt: null,
    updatedAt: 0,
  }
}

function defaultState(): MaxState {
  return { clients: {}, greeted: {}, seen: {} }
}

function readJson<T>(path: string, fallback: T): T {
  if (!existsSync(path)) return fallback
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as T
  }
  catch {
    return fallback
  }
}

function writeJson(path: string, value: unknown) {
  ensureDir()
  if (existsSync(path)) {
    try {
      copyFileSync(path, `${path}.bak`)
    }
    catch {
      // bak best-effort
    }
  }
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(tmp, path)
}

export function getSettings(): MaxSettings {
  const raw = readJson<Partial<MaxSettings>>(settingsPath(), {})
  return { ...defaultSettings(), ...raw }
}

export function saveSettings(patch: Partial<MaxSettings>): MaxSettings {
  const next: MaxSettings = {
    ...getSettings(),
    ...patch,
    updatedAt: Date.now(),
  }
  writeJson(settingsPath(), next)
  return next
}

export function getState(): MaxState {
  const raw = readJson<Partial<MaxState>>(statePath(), {})
  return {
    clients: raw.clients ?? {},
    greeted: raw.greeted ?? {},
    seen: raw.seen ?? {},
  }
}

export function updateState(mutator: (state: MaxState) => void): MaxState {
  const state = getState()
  mutator(state)
  writeJson(statePath(), state)
  return state
}

/** true — mid новый и зафиксирован; false — уже видели. */
export function claimMid(mid: string): boolean {
  let claimed = false
  updateState((state) => {
    const cutoff = Date.now() - SEEN_TTL_MS
    for (const [key, ts] of Object.entries(state.seen)) {
      if (ts < cutoff) delete state.seen[key]
    }
    if (state.seen[mid] != null) return
    state.seen[mid] = Date.now()
    claimed = true
  })
  return claimed
}

/** true — первое приветствие; false — уже здоровались. */
export function claimGreeting(maxUserId: string): boolean {
  let claimed = false
  updateState((state) => {
    if (state.greeted[maxUserId] != null) return
    state.greeted[maxUserId] = Date.now()
    claimed = true
  })
  return claimed
}

export function getClient(maxUserId: string): MaxClient | null {
  return getState().clients[maxUserId] ?? null
}

export function saveClient(maxUserId: string, contactId: string, dealId: string | null) {
  updateState((state) => {
    state.clients[maxUserId] = { contactId, dealId, updatedAt: Date.now() }
  })
}

export function clearDeal(maxUserId: string) {
  updateState((state) => {
    const client = state.clients[maxUserId]
    if (!client) return
    state.clients[maxUserId] = { ...client, dealId: null, updatedAt: Date.now() }
  })
}
