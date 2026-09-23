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
          innerHTML: `(function(){var K='MiniAppInitData';function ok(v){return v.indexOf('hash=')>=0&&v.indexOf('auth_date=')>=0&&v.indexOf('user=')>=0}function slice(raw){raw=(raw||'').replace(/^[?#]/,'');var i=raw.indexOf('WebAppData=');if(i<0)return'';var s=i+11,e=raw.length,m=['&WebAppPlatform=','&WebAppVersion=','&WebAppDeviceName='];for(var x=0;x<m.length;x++){var j=raw.indexOf(m[x],s);if(j>=0)e=Math.min(e,j)}var v=raw.slice(s,e);if(!v)return'';if(v.indexOf('%')>=0){try{v=decodeURIComponent(v)}catch(z){return''}}return ok(v)?v:''}function pick(raw){raw=(raw||'').replace(/^[?#]/,'');var s=slice(raw);if(s)return s;var p=new URLSearchParams(raw);var w=p.get('WebAppData');if(w&&ok(w))return w;if(!(p.has('hash')&&p.has('auth_date')&&p.has('user')))return'';var out=[];if(w&&!ok(w)){var c=w.indexOf('=');if(c>0&&w.slice(0,c).indexOf('WebApp')!==0)out.push(w.slice(0,c)+'='+encodeURIComponent(w.slice(c+1)))}p.forEach(function(v,k){if(k.indexOf('WebApp')===0)return;out.push(k+'='+encodeURIComponent(v))});return out.join('&')}function grab(raw){raw=raw||'';var h=raw.indexOf('#');if(h>=0){var a=pick(raw.slice(h));if(a)return a}var w=raw.indexOf('WebAppData=');if(w>=0){var b=pick(raw.slice(w));if(b)return b}return pick(raw)}function snap(){try{var v=grab(location.hash)||grab(location.href)||grab(document.URL)||grab(location.search);try{var n=performance.getEntriesByType('navigation')[0];if(n&&n.name)v=v||grab(n.name)}catch(e){}var b=window.WebApp&&window.WebApp.initData;if(!v&&b&&ok(b))v=b;if(v&&ok(v)){sessionStorage.setItem(K,v);window.dispatchEvent(new Event('max-init'))}}catch(e){}}snap();window.addEventListener('hashchange',snap);setTimeout(snap,0);var n=0;var t=setInterval(function(){snap();if(++n>150)clearInterval(t)},200)})();`,
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
