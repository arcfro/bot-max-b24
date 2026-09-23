/** Строка initData: обёртка WebAppData, плоский хеш десктопа, storage, мост. */
export function readLaunchInitData(
  hash: string,
  stored: string | null | undefined,
  bridge: string | null | undefined,
): string {
  return webAppDataFrom(hash) || stored || bridge || ''
}

function webAppDataFrom(fragment: string): string {
  const raw = fragment.replace(/^[?#]/, '')
  if (!raw) return ''
  const params = new URLSearchParams(raw)
  const wrapped = params.get('WebAppData')
  if (wrapped) return wrapped
  if (!params.has('hash') || !params.has('auth_date') || !params.has('user')) return ''
  const pairs: string[] = []
  params.forEach((value, key) => {
    if (key.startsWith('WebApp')) return
    pairs.push(`${key}=${encodeURIComponent(value)}`)
  })
  return pairs.join('&')
}
