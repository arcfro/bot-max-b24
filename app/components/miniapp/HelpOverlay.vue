<script setup lang="ts">
import { MINIAPP_HELP_SECTIONS, MINIAPP_HELP_TITLE } from '#shared/miniapp-help'

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="help-overlay" role="dialog" aria-modal="true" :aria-label="MINIAPP_HELP_TITLE">
    <div class="help-panel">
      <header class="help-header">
        <h2>{{ MINIAPP_HELP_TITLE }}</h2>
        <button type="button" class="help-close" aria-label="Закрыть" @click="emit('close')">×</button>
      </header>
      <div class="help-body">
        <section v-for="section in MINIAPP_HELP_SECTIONS" :key="section.title" class="help-section">
          <h3>{{ section.title }}</h3>
          <p v-for="(paragraph, index) in section.paragraphs" :key="`${section.title}-p-${index}`">
            {{ paragraph }}
          </p>
          <ul v-if="section.bullets?.length">
            <li v-for="(bullet, index) in section.bullets" :key="`${section.title}-b-${index}`">
              {{ bullet }}
            </li>
          </ul>
        </section>
      </div>
      <footer class="help-footer">
        <button type="button" class="help-done" @click="emit('close')">Закрыть</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.help-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}

.help-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}

.help-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1rem 0.75rem;
  border-bottom: 1px solid var(--line);
  background: var(--bg-elev);
}

.help-header h2 {
  margin: 0;
  font-size: 1.25rem;
  letter-spacing: -0.02em;
}

.help-close {
  width: 2.25rem;
  height: 2.25rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--ink);
  font-size: 1.35rem;
  line-height: 1;
  cursor: pointer;
  flex: 0 0 auto;
}

.help-body {
  flex: 1;
  overflow: auto;
  padding: 1rem;
  display: grid;
  gap: 1.25rem;
}

.help-section h3 {
  margin: 0 0 0.5rem;
  font-size: 1rem;
}

.help-section p {
  margin: 0 0 0.65rem;
  line-height: 1.45;
  color: var(--ink);
}

.help-section p:last-child {
  margin-bottom: 0;
}

.help-section ul {
  margin: 0;
  padding-left: 1.15rem;
  display: grid;
  gap: 0.55rem;
}

.help-section li {
  line-height: 1.45;
}

.help-footer {
  padding: 0.85rem 1rem calc(0.85rem + env(safe-area-inset-bottom));
  border-top: 1px solid var(--line);
  background: var(--bg-elev);
}

.help-done {
  width: 100%;
}
</style>
