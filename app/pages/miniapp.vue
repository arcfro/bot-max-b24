<template>
  <div class="stack">
    <header>
      <p class="mono" style="margin: 0;">№:{{ dealId || '—' }}</p>
      <h1>{{ dealTitle || 'Нет активной сделки' }}</h1>
    </header>
    <form class="card stack" @submit.prevent="submit()">
      <label>
        ID сделки
        <span class="id-line">
          <input v-model="dealIdInput" inputmode="numeric" autocomplete="off" :disabled="!ready || pending">
          <span v-if="looking" class="spinner" aria-label="Загрузка сделки" />
        </span>
      </label>
      <p v-if="error" class="error" style="margin: 0;">{{ error }}</p>
      <label>
        Название
        <input v-model="title" autocomplete="off" :disabled="pending || looking">
      </label>
      <label>
        Сумма
        <input v-model="amount" inputmode="decimal" autocomplete="off" :disabled="pending || looking">
      </label>
      <label>
        Дата начала
        <input v-model="begin" type="date" :disabled="pending || looking">
      </label>
      <label>
        Дата завершения
        <input v-model="close" type="date" :disabled="pending || looking">
      </label>
      <label>
        Клиент
        <input v-model="clientName" autocomplete="name" :disabled="pending || looking">
      </label>
      <label>
        Файл
        <input ref="fileInput" type="file" :disabled="pending || looking" @change="onFile">
      </label>
      <button type="submit" :disabled="pending || looking || !ready">
        {{ pending ? 'Запись…' : 'Записать' }}
      </button>
      <button
        v-if="dealId"
        class="secondary"
        type="button"
        :disabled="pending || looking || !ready"
        @click="submit(true)"
      >
        Новая сделка
      </button>
      <p v-if="message" class="muted" style="margin: 0;">{{ message }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { BAD_ID } from '#shared/max-commands'
import type { DealForm } from '#shared/miniapp-deal'
import { parseDealIdInput } from '#shared/miniapp-id'
import { MINIAPP_LAUNCH_KEY, readLaunchInitData } from '#shared/miniapp-launch'

useSeoMeta({ title: 'Сделка' })

type DealResponse = DealForm & { message?: string, revision?: number }
type RevisionResponse = { dealId: string | null, updatedAt: number }

const dealId = ref<string | null>(null)
const dealTitle = ref('')
const dealIdInput = ref('')
const title = ref('')
const amount = ref('')
const begin = ref('')
const close = ref('')
const clientName = ref('')
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pending = ref(false)
const looking = ref(false)
const ready = ref(false)
const error = ref('')
const message = ref('')
let initData = ''
let loadedId = ''
let lastRevision = 0
let loadTimer: ReturnType<typeof setTimeout> | undefined
let pollTimer: ReturnType<typeof setInterval> | undefined

function queueDealLookup(value: string) {
  const id = parseDealIdInput(value)
  if (loadTimer) clearTimeout(loadTimer)
  looking.value = false
  if (/^ID:/i.test(value.trim()) && !id) {
    error.value = BAD_ID
    return
  }
  if (!ready.value || !id || id === loadedId) return
  loadTimer = setTimeout(() => openDeal(id), 300)
}

watch(dealIdInput, queueDealLookup)
watch(ready, (isReady) => {
  if (isReady) queueDealLookup(dealIdInput.value)
})

function navigationName(): string {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return entry?.name || ''
}

function webAppInitData(): string {
  const webApp = (window as Window & { WebApp?: { initData?: string } }).WebApp
  const value = readLaunchInitData(location.hash, null, null)
    || readLaunchInitData(location.href, null, null)
    || readLaunchInitData(document.URL, null, null)
    || readLaunchInitData(location.search, null, null)
    || readLaunchInitData(navigationName(), null, null)
    || readLaunchInitData('', sessionStorage.getItem(MINIAPP_LAUNCH_KEY), webApp?.initData)
  if (value) sessionStorage.setItem(MINIAPP_LAUNCH_KEY, value)
  return value
}

function clearLaunchCache() {
  sessionStorage.removeItem(MINIAPP_LAUNCH_KEY)
}

async function waitInitData(): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < 8000) {
    const value = webAppInitData()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return webAppInitData()
}

let lateBound = false

function launchDiag(): string {
  try {
    const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const nav = entry?.name ? new URL(entry.name).hash.length : 0
    const stored = sessionStorage.getItem(MINIAPP_LAUNCH_KEY) ? 1 : 0
    const webView = 'WebViewHandler' in window ? 1 : 0
    const href = location.href.includes('WebAppData') || document.URL.includes('WebAppData') ? 1 : 0
    return `h${location.hash.length} n${nav} u${href} s${stored} v${webView}`
  }
  catch {
    return 'diag'
  }
}

function fail(e: any, fallback: string) {
  error.value = e?.data?.statusMessage || e?.statusMessage || fallback
}

function markRevision(revision?: number) {
  if (revision != null) lastRevision = revision
}

function showDeal(deal: DealResponse, fill: boolean) {
  loadedId = deal.id || ''
  dealId.value = deal.id
  dealTitle.value = deal.title || ''
  dealIdInput.value = deal.id || ''
  markRevision(deal.revision)
  if (!fill) return
  title.value = deal.title || ''
  amount.value = deal.amount || ''
  begin.value = deal.begin || ''
  close.value = deal.close || ''
  clientName.value = deal.client || ''
}

function canAutoSync(): boolean {
  if (!ready.value || !initData || pending.value || looking.value) return false
  const typed = inputDealId()
  return !typed || typed === loadedId
}

async function refreshActiveDeal() {
  if (!canAutoSync()) return
  try {
    const deal = await $fetch<DealResponse>('/api/miniapp/deal', {
      method: 'POST',
      body: { initData },
    })
    if (!canAutoSync()) return
    showDeal(deal, true)
  }
  catch {
    // тихо: бот мог сменить сделку на несуществующую, следующий poll попробует снова
  }
}

async function syncRevision() {
  if (!canAutoSync()) return
  try {
    const rev = await $fetch<RevisionResponse>('/api/miniapp/revision', {
      method: 'POST',
      body: { initData },
    })
    if (!canAutoSync()) return
    if (rev.updatedAt === lastRevision && rev.dealId === dealId.value) return
    await refreshActiveDeal()
  }
  catch {
    // ignore
  }
}

let lookup = 0

function inputDealId(): string | null {
  return parseDealIdInput(dealIdInput.value)
}

async function openDeal(id: string) {
  if (id !== inputDealId()) return
  const ticket = ++lookup
  looking.value = true
  error.value = ''
  try {
    const deal = await $fetch<DealResponse>('/api/miniapp/deal', {
      method: 'POST',
      body: { initData, id },
    })
    if (ticket !== lookup || id !== inputDealId()) return
    showDeal(deal, true)
    message.value = ''
  }
  catch (e: any) {
    if (ticket !== lookup || id !== inputDealId()) return
    const status = e?.statusCode || e?.status
    const text = String(e?.data?.statusMessage || e?.statusMessage || '')
    if (status === 404 || /not[_\s-]*found/i.test(text)) error.value = 'Сделка не найдена'
    else fail(e, 'Сделка не найдена')
  }
  finally {
    if (ticket === lookup) looking.value = false
  }
}
async function loadDeal(retry = true) {
  error.value = ''
  initData = await waitInitData()
  if (!initData) {
    error.value = `Откройте экран из MAX (${launchDiag()})`
    if (!lateBound) {
      lateBound = true
      const pull = () => {
        const value = webAppInitData()
        if (!value) return
        window.removeEventListener('hashchange', pull)
        window.removeEventListener('max-init', pull)
        loadDeal()
      }
      window.addEventListener('hashchange', pull)
      window.addEventListener('max-init', pull)
    }
    return
  }
  ready.value = true
  try {
    const deal = await $fetch<DealResponse>('/api/miniapp/deal', {
      method: 'POST',
      body: { initData },
    })
    showDeal(deal, true)
  }
  catch (e: any) {
    const status = e?.statusCode || e?.status
    const text = String(e?.data?.statusMessage || e?.statusMessage || '')
    if (retry && status === 401 && /\((sig|age)\)/.test(text)) {
      clearLaunchCache()
      initData = await waitInitData()
      if (initData) return loadDeal(false)
    }
    fail(e, 'Не удалось прочитать сделку')
  }
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

async function submit(forceNew = false) {
  error.value = ''
  message.value = ''
  pending.value = true
  try {
    const body = new FormData()
    body.set('initData', initData)
    body.set('title', title.value)
    body.set('amount', amount.value)
    body.set('begin', begin.value)
    body.set('close', close.value)
    body.set('client', clientName.value)
    if (forceNew) body.set('newDeal', '1')
    if (file.value) body.set('file', file.value)
    const deal = await $fetch<DealResponse>('/api/miniapp/apply', { method: 'POST', body })
    showDeal(deal, true)
    message.value = deal.message || 'Записано'
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
  }
  catch (e: any) {
    fail(e, 'Не удалось записать')
  }
  finally {
    pending.value = false
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') syncRevision()
}

onMounted(() => {
  loadDeal()
  pollTimer = setInterval(syncRevision, 2500)
  document.addEventListener('visibilitychange', onVisible)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<style scoped>
h1 {
  font-size: 1.35rem;
  margin: 0.2rem 0 0;
}

button {
  width: 100%;
}

.id-line {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.id-line input {
  flex: 1;
}

.spinner {
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
  border: 2px solid var(--line);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
