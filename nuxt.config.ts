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
        {
          innerHTML: `(function(){function snap(){try{var p=new URLSearchParams((location.hash||'').replace(/^#/,''));var v=p.get('WebAppData');if(v)sessionStorage.setItem('WebAppData',v);var w=window.WebApp&&window.WebApp.initData;if(w)sessionStorage.setItem('WebAppData',w)}catch(e){}}snap();var n=0;var t=setInterval(function(){snap();if(++n>100)clearInterval(t)},50)})();`,
        },
        { src: 'https://st.max.ru/js/max-web-app.js' },
      ],
    },
  },
  telemetry: false,
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  modules: ['@pinia/nuxt', 'nuxt-auth-utils'],
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
  nitro: {
    alias: {
      '#shared': shared,
    },
  },
  alias: {
    '#shared': shared,
  },
})
