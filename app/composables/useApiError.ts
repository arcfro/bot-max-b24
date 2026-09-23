type FetchLikeError = {
  statusCode?: number
  status?: number
  statusMessage?: string
  data?: { statusMessage?: string }
}

export function fetchErrorStatus(error: unknown): number | undefined {
  const e = error as FetchLikeError
  return e?.statusCode ?? e?.status
}

export function apiErrorMessage(error: unknown, fallback: string): string {
  const e = error as FetchLikeError
  return e?.data?.statusMessage || e?.statusMessage || fallback
}
