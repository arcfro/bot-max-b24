/** Строка initData: обёртка WebAppData, плоский хеш десктопа, storage, мост. */
export function readLaunchInitData(
  hash: string,
  stored: string | null | undefined,
  bridge: string | null | undefined,
): string {
  return webAppDataFrom(hash) || stored || bridge || ''
}

function looksLikeInitData(value: string): boolean {
  return value.includes('hash=') || value.includes('auth_date=') || value.includes('user=')
}

function webAppDataFrom(fragment: string): string {
  const raw = fragment.replace(/^[?#]/, '')
  if (!raw) return ''
  const params = new URLSearchParams(raw)
  const wrapped = params.get('WebAppData')
  // Десктоп иногда отдаёт хеш уже раскодированным: WebAppData обрывается на start_param=
  if (wrapped && looksLikeInitData(wrapped)) return wrapped
  if (!params.has('hash') || !params.has('auth_date') || !params.has('user')) return ''
  const pairs: string[] = []
  const cut = wrapped && !looksLikeInitData(wrapped) ? wrapped.indexOf('=') : -1
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
