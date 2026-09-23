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
        <PasswordInput
          v-model="maxToken"
          autocomplete="off"
          :placeholder="maxStatus?.connected ? 'сохранён — введите новый, чтобы заменить' : 'вставьте токен'"
        />
      </label>
      <label>
        <span class="check-line">
          Вебхук CRM Битрикс24
          <span v-if="maxStatus?.bitrixWebhookHost" class="ok-mark" title="Вебхук проверен">✓</span>
        </span>
        <PasswordInput
          v-model="bitrixWebhook"
          autocomplete="off"
          :placeholder="maxStatus?.bitrixWebhookHost ? 'сохранён — введите новый, чтобы заменить' : 'https://портал.bitrix24.ru/rest/1/код/'"
        />
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
useSeoMeta({ title: 'Настройки MAX' })

const { clear: clearSession } = useUserSession()
const {
  maxToken,
  bitrixWebhook,
  maxStatus,
  maxPending,
  maxErrors,
  allowFrom,
  allowlistEnabled,
  allowPending,
  allowError,
  allowSaved,
  loadError,
  maxWebhookHint,
  formatDateTime,
  saveAllowlist,
  connectMax,
} = useMaxSettings()

const logoutPending = ref(false)

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
