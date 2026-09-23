<template>
  <div class="stack">
    <header>
      <p class="mono" style="margin: 0;">№:{{ dealId || '—' }}</p>
      <h1>{{ dealTitle || 'Нет активной сделки' }}</h1>
    </header>
    <form class="card stack" @submit.prevent="submit">
      <label>
        Название
        <input v-model="title" autocomplete="off" :disabled="pending">
      </label>
      <label>
        Сумма
        <input v-model="amount" inputmode="decimal" autocomplete="off" :disabled="pending">
      </label>
      <label>
        Дата начала
        <input v-model="begin" type="date" :disabled="pending">
      </label>
      <label>
        Дата завершения
        <input v-model="close" type="date" :disabled="pending">
      </label>
      <label>
        Клиент
        <input v-model="clientName" autocomplete="name" :disabled="pending">
      </label>
      <label>
        Файл
        <input ref="fileInput" type="file" :disabled="pending" @change="onFile">
      </label>
      <button type="submit" :disabled="pending || !ready">
        {{ pending ? 'Запись…' : 'Записать' }}
      </button>
      <p v-if="message" class="muted" style="margin: 0;">{{ message }}</p>
      <p v-if="error" class="error" style="margin: 0;">{{ error }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
useSeoMeta({ title: 'Сделка' })
useHead({
  script: [{ src: 'https://st.max.ru/js/max-web-app.js', defer: true }],
})

type DealResponse = { id: string | null, title: string | null, message?: string }

const dealId = ref<string | null>(null)
const dealTitle = ref('')
const title = ref('')
const amount = ref('')
const begin = ref('')
const close = ref('')
const clientName = ref('')
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const pending = ref(false)
const ready = ref(false)
const error = ref('')
const message = ref('')
let initData = ''

function webAppInitData(): string {
  const webApp = (window as Window & { WebApp?: { initData?: string } }).WebApp
  return webApp?.initData || ''
}

async function waitInitData(): Promise<string> {
  const started = Date.now()
  while (Date.now() - started < 4000) {
    const value = webAppInitData()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  return webAppInitData()
}

function fail(e: any, fallback: string) {
  error.value = e?.data?.statusMessage || e?.statusMessage || fallback
}

async function loadDeal() {
  error.value = ''
  initData = await waitInitData()
  if (!initData) {
    error.value = 'Откройте экран из MAX'
    return
  }
  ready.value = true
  try {
    const deal = await $fetch<DealResponse>('/api/miniapp/deal', {
      method: 'POST',
      body: { initData },
    })
    dealId.value = deal.id
    dealTitle.value = deal.title || ''
  }
  catch (e: any) {
    fail(e, 'Не удалось прочитать сделку')
  }
}

function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  file.value = input.files?.[0] ?? null
}

async function submit() {
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
    if (file.value) body.set('file', file.value)
    const deal = await $fetch<DealResponse>('/api/miniapp/apply', { method: 'POST', body })
    dealId.value = deal.id
    dealTitle.value = deal.title || ''
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
</style>
