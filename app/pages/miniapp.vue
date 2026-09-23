<template>
  <div class="miniapp-page stack">
    <button
      type="button"
      class="help-fab"
      aria-label="Инструкция"
      @click="helpOpen = true"
    >
      ?
    </button>
    <MiniappHelpOverlay v-if="helpOpen" @close="helpOpen = false" />
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
      <p v-if="displayError" class="error" style="margin: 0;">{{ displayError }}</p>
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
        <span class="file-row">
          <input
            ref="fileInput"
            class="file-input-hidden"
            type="file"
            :disabled="pending || looking || !ready"
            @change="onFile"
          >
          <button
            type="button"
            class="secondary file-btn"
            :disabled="pending || looking || !ready"
            @click="pickFile"
          >
            {{ fileLabel }}
          </button>
        </span>
      </label>
      <MiniappDealFileList
        v-if="dealId"
        :files="files"
        :disabled="pending || looking || !ready"
        :deleting-id="deletingFileId"
        @delete="deleteFile"
      />
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
useSeoMeta({ title: 'Сделка' })

const { initData, ready, initError, resolveInitData, refreshInitData, bindLateLoad, isAuthRetryable } = useMiniappInitData()
const {
  dealId,
  dealTitle,
  dealIdInput,
  title,
  amount,
  begin,
  close,
  clientName,
  fileInput,
  fileLabel,
  files,
  pending,
  looking,
  deletingFileId,
  error,
  message,
  loadActiveDeal,
  syncRevision,
  pickFile,
  onFile,
  deleteFile,
  submit,
} = useMiniappDeal(initData, ready)

const displayError = computed(() => initError.value || error.value)
const helpOpen = ref(false)

let pollTimer: ReturnType<typeof setInterval> | undefined

async function loadDeal(retry = true) {
  initError.value = ''
  error.value = ''
  const resolved = await resolveInitData()
  if (!resolved) {
    bindLateLoad(() => loadDeal(retry))
    return
  }
  try {
    await loadActiveDeal()
  }
  catch (e: unknown) {
    if (retry && isAuthRetryable(e)) {
      const refreshed = await refreshInitData(true)
      if (refreshed) return loadDeal(false)
    }
    error.value = apiErrorMessage(e, 'Не удалось прочитать сделку')
  }
}

function onVisible() {
  if (document.visibilityState === 'visible') syncRevision()
}

onMounted(() => {
  ;(window as Window & { WebApp?: { ready?: () => void } }).WebApp?.ready?.()
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
.miniapp-page {
  position: relative;
}

.help-fab {
  position: fixed;
  top: calc(0.85rem + env(safe-area-inset-top));
  right: calc(0.85rem + env(safe-area-inset-right));
  z-index: 20;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--bg-elev);
  color: var(--accent);
  box-shadow: var(--shadow);
  font-size: 1.15rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}

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

.file-row {
  display: flex;
}

.file-btn {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-input-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>
