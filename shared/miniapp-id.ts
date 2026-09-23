/** STAGE_ID сделки из crm.deal. */
export function parseStageId(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '').trim()
  return trimmed ? trimmed : null
}

/** ID воронки сделки: неотрицательное целое. */
export function parseCategoryId(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '').trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  return null
}

/** ID сделки из поля: число или команда ID:14. */
export function parseDealIdInput(raw: string): string | null {
  const trimmed = raw.trim()
  const command = /^ID:\s*(\d+)$/i.exec(trimmed)
  if (command) return command[1]
  if (/^\d+$/.test(trimmed)) return trimmed
  return null
}
