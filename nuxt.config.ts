import { fileURLToPath } from 'node:url'

const shared = fileURLToPath(new URL('./shared', import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: false,
  app: {
    head: {
      htmlAttrs: { lang: 'ru' },
      title: 'MAX ↔ Битрикс24',
      script: [
        { src: '/miniapp-bootstrap.js' },
        { src: 'https://st.max.ru/js/max-web-app.js' },
      ],
    },
  },
  telemetry: false,
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  modules: ['nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    session: {
      password: '',
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    },
    dataDir: process.env.DATA_DIR || './data',
    admins: process.env.ADMINS || '[]',
    public: {
      appUrl: process.env.NUXT_PUBLIC_APP_URL || '',
    },
  },
  routeRules: {
    '/miniapp': { headers: { 'cache-control': 'no-store' } },
  },
  nitro: {
    alias: {
      '#shared': shared,
    },
  },
  alias: {
    '#shared': shared,
  },
})
