<script setup lang="ts">
import { dealFileDate } from '#shared/miniapp-deal'
import type { DealFile } from '#shared/miniapp-deal'

defineProps<{
  files: DealFile[]
  disabled?: boolean
  deletingId?: string | null
}>()

const emit = defineEmits<{
  delete: [fileId: string]
}>()
</script>

<template>
  <div class="file-list-wrap">
    <p class="file-list-title">Файлы сделки</p>
    <ul v-if="files.length" class="file-list">
      <li v-for="file in files" :key="file.id">
        <span class="file-name">{{ file.name }}</span>
        <span class="file-meta">
          <span v-if="dealFileDate(file.created)" class="file-date muted">{{ dealFileDate(file.created) }}</span>
          <button
            type="button"
            class="file-delete"
            :disabled="disabled || deletingId === file.id"
            aria-label="Удалить файл"
            @click="emit('delete', file.id)"
          >
            {{ deletingId === file.id ? '…' : '×' }}
          </button>
        </span>
      </li>
    </ul>
    <p v-else class="muted file-empty">Пока нет файлов</p>
  </div>
</template>

<style scoped>
.file-list-wrap {
  display: grid;
  gap: 0.45rem;
}

.file-list-title {
  margin: 0;
  font-size: 0.9rem;
  color: var(--muted);
}

.file-list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.35rem;
}

.file-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  background: var(--input-bg);
}

.file-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex: 0 0 auto;
}

.file-date {
  font-size: 0.82rem;
}

.file-delete {
  width: 1.65rem;
  height: 1.65rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--muted);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.file-delete:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.file-empty {
  margin: 0;
  font-size: 0.9rem;
}
</style>
