<template>
  <div class="stack">
    <div class="card stack">
      <div class="nav" style="justify-content: space-between;">
        <h1 style="margin: 0;">Интеграция с MAX</h1>
        <button class="secondary" type="button" :disabled="logoutPending" @click="logout">
          {{ logoutPending ? 'Выход…' : 'Выйти' }}
        </button>
      </div>
      <p class="muted" style="margin: 0;">
        «Подключить» проверяет только заполненные поля и сохраняет те, что прошли.
        Токен дополнительно подписывает бота на
        <span class="mono">{{ maxWebhookHint }}</span>
        — для этого нужен публичный HTTPS.
      </p>
      <label>
        <span class="check-line">
          Токен бота
          <span v-if="maxStatus?.connected" class="ok-mark" title="Токен проверен">✓</span>
        </span>
        <input
          v-model="maxToken"
          type="password"
          autocomplete="off"
          spellcheck="false"
          :placeholder="maxStatus?.connected ? 'сохранён — введите новый, чтобы заменить' : 'вставьте токен'"
        >
      </label>
      <label>
        <span class="check-line">
          Вебхук CRM Битрикс24
          <span v-if="maxStatus?.bitrixWebhookHost" class="ok-mark" title="Вебхук проверен">✓</span>
        </span>
        <input
          v-model="bitrixWebhook"
          type="password"
          autocomplete="off"
          spellcheck="false"
          :placeholder="maxStatus?.bitrixWebhookHost ? 'сохранён — введите новый, чтобы заменить' : 'https://портал.bitrix24.ru/rest/1/код/'"
        >
      </label>
      <div class="nav" style="align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        <button
          type="button"
          :disabled="maxPending || (!maxToken.trim() && !bitrixWebhook.trim())"
          @click="connectMax"
        >
          {{ maxPending ? 'Подключение…' : 'Подключить' }}
        </button>
        <span v-if="maxStatus?.connected" class="muted">
          Подключено<span v-if="maxStatus.botName">: {{ maxStatus.botName }}</span>
          <template v-if="maxStatus.subscribedAt"> · {{ formatDateTime(maxStatus.subscribedAt) }}</template>
        </span>
      </div>
      <div>
        <span class="check-line">
          Получать сообщения только от
          <label class="check-line">
            <input v-model="allowlistEnabled" type="checkbox">
            Включить
          </label>
        </span>
        <textarea
          v-model="allowFrom"
          rows="4"
          spellcheck="false"
          placeholder="100500, @ivanov"
        />
      </div>
      <p class="muted" style="margin: 0;">
        Уникальный аккаунт MAX — это числовой id или короткое имя (@username, ссылка max.ru/username).
        Несколько значений через запятую или с новой строки. Пока флажок выключен, бот отвечает всем.
        Остальным бот отвечает, что нет прав писать. Включённый пустой список — отказ всем.
      </p>
      <div class="nav" style="align-items: center; gap: 0.75rem;">
        <button
          class="secondary"
          type="button"
          :disabled="allowPending"
          @click="saveAllowlist"
        >
          {{ allowPending ? 'Сохранение…' : 'Сохранить список' }}
        </button>
        <span v-if="allowSaved" class="muted">Сохранено</span>
      </div>
      <p v-if="allowError" class="error" style="margin: 0;">{{ allowError }}</p>
      <p v-if="maxStatus?.webhookUrl" class="mono muted" style="margin: 0;">{{ maxStatus.webhookUrl }}</p>
      <p v-if="maxStatus?.bitrixWebhookHost" class="mono muted" style="margin: 0;">Битрикс24: {{ maxStatus.bitrixWebhookHost }}</p>
      <p v-for="(line, i) in maxErrors" :key="i" class="error" style="margin: 0;">{{ line }}</p>
      <p v-if="loadError" class="error" style="margin: 0;">{{ loadError }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MaxStatus } from '#shared/max-status'

useSeoMeta({ title: 'Настройки MAX' })

const { clear: clearSession } = useUserSession()
const maxToken = ref('')
const bitrixWebhook = ref('')
const maxStatus = ref<MaxStatus | null>(null)
const maxPending = ref(false)
const maxErrors = ref<string[]>([])
const allowFrom = ref('')
const allowlistEnabled = ref(false)
const allowPending = ref(false)
const allowError = ref('')
const allowSaved = ref(false)
const loadError = ref('')
const logoutPending = ref(false)

const maxWebhookHint = computed(() => {
  const origin = String(useRuntimeConfig().public.appUrl || '').replace(/\/$/, '')
  return origin ? `${origin}/api/max/webhook` : '/api/max/webhook'
})

function formatDateTime(ms: number) {
  return new Date(ms).toLocaleString('ru-RU')
}

async function loadMax() {
  loadError.value = ''
  try {
    const status = await $fetch<MaxStatus>('/api/settings/max')
    maxStatus.value = status
    allowFrom.value = status.allowFrom
    allowlistEnabled.value = status.allowlistEnabled
  }
  catch (e: any) {
    maxStatus.value = null
    loadError.value = e?.data?.statusMessage || e?.statusMessage || 'Не удалось загрузить статус'
  }
}

async function saveAllowlist() {
  allowError.value = ''
  allowSaved.value = false
  allowPending.value = true
  try {
    const res = await $fetch<MaxStatus>('/api/settings/max', {
      method: 'POST',
      body: {
        allowFrom: allowFrom.value,
        allowlistEnabled: allowlistEnabled.value,
      },
    })
    maxStatus.value = res
    allowFrom.value = res.allowFrom
    allowlistEnabled.value = res.allowlistEnabled
    allowSaved.value = true
  }
  catch (e: any) {
    allowError.value = e?.data?.statusMessage || e?.statusMessage || 'Не удалось сохранить список'
  }
  finally {
    allowPending.value = false
  }
}

async function connectMax() {
  maxErrors.value = []
  maxPending.value = true
  const sentToken = maxToken.value.trim()
  const sentBitrix = bitrixWebhook.value.trim()
  try {
    const res = await $fetch<MaxStatus>('/api/settings/max', {
      method: 'POST',
      body: {
        token: sentToken,
        bitrixWebhook: sentBitrix,
      },
    })
    maxStatus.value = res
    if (sentToken && !res.tokenError) maxToken.value = ''
    if (sentBitrix && !res.bitrixError) bitrixWebhook.value = ''
    maxErrors.value = [res.tokenError, res.bitrixError].filter((line): line is string => !!line)
  }
  catch (e: any) {
    maxErrors.value = [e?.data?.statusMessage || e?.statusMessage || 'Не удалось подключить']
  }
  finally {
    maxPending.value = false
  }
}

async function logout() {
  logoutPending.value = true
  try {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clearSession()
    await navigateTo('/login')
  }
  finally {
    logoutPending.value = false
  }
}

onMounted(() => {
  loadMax()
})
</script>

<style scoped>
.check-line {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.ok-mark {
  color: var(--ok);
  font-weight: 700;
  line-height: 1;
}
</style>
