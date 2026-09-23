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
          innerHTML: `(function(){function pick(raw){raw=(raw||'').replace(/^[?#]/,'');if(!raw)return'';var p=new URLSearchParams(raw);var w=p.get('WebAppData');function ok(v){return v.indexOf('hash=')>=0||v.indexOf('auth_date=')>=0||v.indexOf('user=')>=0}if(w&&ok(w))return w;if(!(p.has('hash')&&p.has('auth_date')&&p.has('user')))return'';var out=[];if(w&&!ok(w)){var c=w.indexOf('=');if(c>0&&w.slice(0,c).indexOf('WebApp')!==0)out.push(w.slice(0,c)+'='+encodeURIComponent(w.slice(c+1)))}p.forEach(function(v,k){if(k.indexOf('WebApp')===0)return;out.push(k+'='+encodeURIComponent(v))});return out.join('&')}function grab(raw){raw=raw||'';var h=raw.indexOf('#');if(h>=0){var a=pick(raw.slice(h));if(a)return a}var w=raw.indexOf('WebAppData=');if(w>=0){var b=pick(raw.slice(w));if(b)return b}return pick(raw)}function snap(){try{var v=grab(location.hash)||grab(location.href)||grab(document.URL)||grab(location.search);try{var n=performance.getEntriesByType('navigation')[0];if(n&&n.name)v=v||grab(n.name)}catch(e){}var b=window.WebApp&&window.WebApp.initData;if(!v&&b&&b.indexOf('hash=')>=0&&b.indexOf('auth_date=')>=0)v=b;if(v&&v.indexOf('hash=')>=0&&v.indexOf('auth_date=')>=0){sessionStorage.setItem('WebAppData',v);window.dispatchEvent(new Event('max-init'))}}catch(e){}}snap();window.addEventListener('hashchange',snap);setTimeout(snap,0);var n=0;var t=setInterval(function(){snap();if(++n>150)clearInterval(t)},200)})();`,
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
