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
import { readLaunchInitData } from '#shared/miniapp-launch'
import type { DealForm } from '#shared/miniapp-deal'

useSeoMeta({ title: 'Сделка' })

type DealResponse = DealForm & { message?: string }

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
let loadTimer: ReturnType<typeof setTimeout> | undefined

watch(dealIdInput, (value) => {
  const id = value.trim()
  if (loadTimer) clearTimeout(loadTimer)
  looking.value = false
  if (!ready.value || !/^\d+$/.test(id) || id === loadedId) return
  loadTimer = setTimeout(() => openDeal(id), 300)
})

function navigationFragment(): string {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (!entry?.name) return ''
  try {
    const url = new URL(entry.name)
    return `${url.hash}&${url.search.replace(/^\?/, '')}`
  }
  catch {
    return ''
  }
}

function webAppInitData(): string {
  const webApp = (window as Window & { WebApp?: { initData?: string } }).WebApp
  const value = readLaunchInitData(location.hash, sessionStorage.getItem('WebAppData'), webApp?.initData)
    || readLaunchInitData(location.search, null, null)
    || readLaunchInitData(navigationFragment(), null, null)
  if (value) sessionStorage.setItem('WebAppData', value)
  return value
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
    const stored = sessionStorage.getItem('WebAppData') ? 1 : 0
    const webView = 'WebViewHandler' in window ? 1 : 0
    return `h${location.hash.length} n${nav} s${stored} v${webView}`
  }
  catch {
    return 'diag'
  }
}

function fail(e: any, fallback: string) {
  error.value = e?.data?.statusMessage || e?.statusMessage || fallback
}

function showDeal(deal: DealResponse, fill: boolean) {
  loadedId = deal.id || ''
  dealId.value = deal.id
  dealTitle.value = deal.title || ''
  dealIdInput.value = deal.id || ''
  if (!fill) return
  title.value = deal.title || ''
  amount.value = deal.amount || ''
  begin.value = deal.begin || ''
  close.value = deal.close || ''
  clientName.value = deal.client || ''
}

let lookup = 0

async function openDeal(id: string) {
  if (id !== dealIdInput.value.trim()) return
  const ticket = ++lookup
  looking.value = true
  error.value = ''
  try {
    const deal = await $fetch<DealResponse>('/api/miniapp/deal', {
      method: 'POST',
      body: { initData, id },
    })
    if (ticket !== lookup || id !== dealIdInput.value.trim()) return
    showDeal(deal, true)
    message.value = ''
  }
  catch (e: any) {
    if (ticket !== lookup || id !== dealIdInput.value.trim()) return
    const status = e?.statusCode || e?.status
    const text = String(e?.data?.statusMessage || e?.statusMessage || '')
    if (status === 404 || /not[_\s-]*found/i.test(text)) error.value = 'Сделка не найдена'
    else fail(e, 'Сделка не найдена')
  }
  finally {
    if (ticket === lookup) looking.value = false
  }
}
async function loadDeal() {
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
    showDeal({ ...deal, amount: '', begin: '', close: '', client: '' }, false)
    message.value = deal.message || 'Записано'
    title.value = ''
    amount.value = ''
    begin.value = ''
    close.value = ''
    clientName.value = ''
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

onMounted(() => {
  loadDeal()
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
