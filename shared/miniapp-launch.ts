export const MINIAPP_LAUNCH_KEY = 'MiniAppInitData'

/** Строка initData: полный URL, хеш, storage, мост. Обрезок start_param= не принимается. */
export function readLaunchInitData(
  hash: string,
  stored: string | null | undefined,
  bridge: string | null | undefined,
): string {
  return launchFrom(hash) || signedLaunch(stored) || signedLaunch(bridge) || ''
}

function signedLaunch(value: string | null | undefined): string {
  if (!value) return ''
  if (!value.includes('hash=') || !value.includes('auth_date=') || !value.includes('user=')) return ''
  return value
}

function launchFrom(raw: string): string {
  if (!raw) return ''
  const hashAt = raw.indexOf('#')
  if (hashAt >= 0) {
    const fromHash = webAppDataFrom(raw.slice(hashAt))
    if (fromHash) return fromHash
  }
  const at = raw.indexOf('WebAppData=')
  if (at >= 0) {
    const fromData = webAppDataFrom(raw.slice(at))
    if (fromData) return fromData
  }
  return webAppDataFrom(raw)
}

function sliceWebAppData(raw: string): string {
  const i = raw.indexOf('WebAppData=')
  if (i < 0) return ''
  let start = i + 'WebAppData='.length
  let end = raw.length
  for (const marker of ['&WebAppPlatform=', '&WebAppVersion=', '&WebAppDeviceName=']) {
    const at = raw.indexOf(marker, start)
    if (at >= 0) end = Math.min(end, at)
  }
  let value = raw.slice(start, end)
  if (!value) return ''
  if (value.includes('%')) {
    try {
      value = decodeURIComponent(value)
    }
    catch {
      return ''
    }
  }
  return signedLaunch(value) ? value : ''
}

function webAppDataFrom(fragment: string): string {
  const raw = fragment.replace(/^[?#]/, '')
  if (!raw) return ''
  const sliced = sliceWebAppData(raw)
  if (sliced) return sliced
  const params = new URLSearchParams(raw)
  const wrapped = params.get('WebAppData')
  if (wrapped && signedLaunch(wrapped)) return wrapped
  if (!params.has('hash') || !params.has('auth_date') || !params.has('user')) return ''
  const pairs: string[] = []
  const cut = wrapped && !signedLaunch(wrapped) ? wrapped.indexOf('=') : -1
  if (wrapped && cut > 0) {
    const key = wrapped.slice(0, cut)
    if (!key.startsWith('WebApp')) pairs.push(`${key}=${encodeURIComponent(wrapped.slice(cut + 1))}`)
  }
  params.forEach((value, key) => {
    if (key.startsWith('WebApp')) return
    pairs.push(`${key}=${encodeURIComponent(value)}`)
  })
  return pairs.join('&')
}
