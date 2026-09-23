import { MINIAPP_LAUNCH_KEY, readLaunchInitData } from '#shared/miniapp-launch'

function navigationName(): string {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  return entry?.name || ''
}

export function useMiniappInitData() {
  const initData = ref('')
  const ready = ref(false)
  const initError = ref('')

  function readCurrent(): string {
    const webApp = (window as Window & { WebApp?: { initData?: string } }).WebApp
    const value = readLaunchInitData(location.hash, null, null)
      || readLaunchInitData(location.href, null, null)
      || readLaunchInitData(document.URL, null, null)
      || readLaunchInitData(location.search, null, null)
      || readLaunchInitData(navigationName(), null, null)
      || readLaunchInitData('', sessionStorage.getItem(MINIAPP_LAUNCH_KEY), webApp?.initData)
    if (value) sessionStorage.setItem(MINIAPP_LAUNCH_KEY, value)
    return value
  }

  function clearCache() {
    sessionStorage.removeItem(MINIAPP_LAUNCH_KEY)
  }

  function launchDiag(): string {
    try {
      const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
      const nav = entry?.name ? new URL(entry.name).hash.length : 0
      const stored = sessionStorage.getItem(MINIAPP_LAUNCH_KEY) ? 1 : 0
      const webView = 'WebViewHandler' in window ? 1 : 0
      const href = location.href.includes('WebAppData') || document.URL.includes('WebAppData') ? 1 : 0
      return `h${location.hash.length} n${nav} u${href} s${stored} v${webView}`
    }
    catch {
      return 'diag'
    }
  }

  async function waitInitData(): Promise<string> {
    const started = Date.now()
    while (Date.now() - started < 8000) {
      const value = readCurrent()
      if (value) return value
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    return readCurrent()
  }

  let lateBound = false

  function bindLateLoad(onReady: () => void) {
    if (lateBound) return
    lateBound = true
    const pull = () => {
      if (!readCurrent()) return
      window.removeEventListener('hashchange', pull)
      window.removeEventListener('max-init', pull)
      onReady()
    }
    window.addEventListener('hashchange', pull)
    window.addEventListener('max-init', pull)
  }

  async function resolveInitData(): Promise<boolean> {
    initError.value = ''
    initData.value = await waitInitData()
    if (!initData.value) {
      initError.value = `Откройте экран из MAX (${launchDiag()})`
      return false
    }
    ready.value = true
    return true
  }

  async function refreshInitData(): Promise<boolean> {
    clearCache()
    initData.value = await waitInitData()
    if (!initData.value) return false
    ready.value = true
    return true
  }

  function isAuthRetryable(error: unknown): boolean {
    const status = fetchErrorStatus(error)
    const text = apiErrorMessage(error, '')
    return status === 401 && /\((sig|age)\)/.test(text)
  }

  return {
    initData,
    ready,
    initError,
    readCurrent,
    clearCache,
    launchDiag,
    waitInitData,
    resolveInitData,
    refreshInitData,
    bindLateLoad,
    isAuthRetryable,
  }
}
