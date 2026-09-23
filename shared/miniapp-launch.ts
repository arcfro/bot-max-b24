/** Строка initData так же, как её читает max-web-app.js: hash → sessionStorage → bridge. */
export function readLaunchInitData(
  hash: string,
  stored: string | null | undefined,
  bridge: string | null | undefined,
): string {
  const fromHash = new URLSearchParams(hash.replace(/^#/, '')).get('WebAppData')
  return fromHash || stored || bridge || ''
}
