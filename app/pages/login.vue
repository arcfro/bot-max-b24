<template>
  <div class="card stack auth-card">
    <h1>Вход</h1>
    <p class="muted" style="margin: 0;">MAX ↔ Битрикс24</p>
    <form class="stack" @submit.prevent="onSubmit">
      <label>
        Email
        <input v-model="email" type="email" autocomplete="username" required>
      </label>
      <label>
        Пароль
        <input v-model="password" type="password" autocomplete="current-password" required>
      </label>
      <p v-if="error" class="error">{{ error }}</p>
      <button type="submit" :disabled="pending">Войти</button>
    </form>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })

const route = useRoute()
const { fetch: fetchSession, loggedIn } = useUserSession()
const email = ref('')
const password = ref('')
const error = ref('')
const pending = ref(false)

onMounted(() => {
  if (loggedIn.value) navigateTo('/')
})

async function onSubmit() {
  error.value = ''
  pending.value = true
  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    await fetchSession()
    const redirect = route.query.redirect
    const path = typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')
      ? redirect
      : '/'
    await navigateTo(path)
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage || e?.statusMessage || 'Ошибка входа'
  }
  finally {
    pending.value = false
  }
}
</script>

<style scoped>
.auth-card {
  max-width: 22rem;
  margin: 4rem auto;
}
</style>
