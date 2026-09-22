<template>
  <div class="password-field">
    <input
      :id="inputId"
      :value="modelValue"
      :type="visible ? 'text' : 'password'"
      :autocomplete="autocomplete"
      :required="required"
      :minlength="minlength"
      :placeholder="placeholder"
      :name="name"
      @input="onInput"
    >
    <button
      type="button"
      class="eye"
      :aria-label="visible ? 'Скрыть пароль' : 'Показать пароль'"
      :title="visible ? 'Скрыть пароль' : 'Показать пароль'"
      tabindex="-1"
      @click="visible = !visible"
    >
      <svg v-if="!visible" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
      </svg>
      <svg v-else viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path fill="currentColor" d="M3.3 2.3 2 3.6l3.1 3.1C3.1 8.1 1.5 9.9.9 12c1.7 3.9 6 7 11.1 7 2 0 3.9-.5 5.5-1.3l3.5 3.5 1.3-1.3L3.3 2.3zM12 17c-3.7 0-7-2.2-8.6-5 .7-1.4 1.9-2.7 3.4-3.6l1.7 1.7A5 5 0 0 0 12 17zm0-10c3.7 0 7 2.2 8.6 5-.5 1-1.3 2-2.3 2.7l-1.5-1.5c.1-.4.2-.8.2-1.2a5 5 0 0 0-5-5c-.4 0-.8.1-1.2.2L9.3 5.7C10.1 5.3 11 5 12 5z" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  modelValue: string
  autocomplete?: string
  required?: boolean
  minlength?: number | string
  placeholder?: string
  name?: string
  inputId?: string
}>(), {
  autocomplete: 'current-password',
  required: false,
})

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const visible = ref(false)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style scoped>
.password-field {
  position: relative;
  display: block;
}

.password-field input {
  width: 100%;
  padding-right: 2.6rem;
}

.eye {
  position: absolute;
  right: 0.35rem;
  top: 50%;
  transform: translateY(-50%);
  width: 2rem;
  height: 2rem;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.eye:hover {
  color: var(--ink);
  background: color-mix(in srgb, var(--line) 55%, transparent);
}
</style>
