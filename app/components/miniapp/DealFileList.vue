<script setup lang="ts">
import { dealFileDate } from '#shared/miniapp-deal'
import type { DealFile } from '#shared/miniapp-deal'

defineProps<{
  files: DealFile[]
}>()
</script>

<template>
  <div class="file-list-wrap">
    <p class="file-list-title">Файлы сделки</p>
    <ul v-if="files.length" class="file-list">
      <li v-for="file in files" :key="file.id">
        <span class="file-name">{{ file.name }}</span>
        <span v-if="dealFileDate(file.created)" class="file-date muted">{{ dealFileDate(file.created) }}</span>
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

.file-date {
  flex: 0 0 auto;
  font-size: 0.82rem;
}

.file-empty {
  margin: 0;
  font-size: 0.9rem;
}
</style>
