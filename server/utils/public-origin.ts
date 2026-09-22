import type { H3Event } from 'h3'

export function publicOrigin(event: H3Event): string {
  const fromEnv = String(useRuntimeConfig().public.appUrl || '').replace(/\/$/, '')
  if (fromEnv) return fromEnv
  return getRequestURL(event).origin
}
