/** ID сделки из поля: число или команда ID:14. */
export function parseDealIdInput(raw: string): string | null {
  const trimmed = raw.trim()
  const command = /^ID:\s*(\d+)$/i.exec(trimmed)
  if (command) return command[1]
  if (/^\d+$/.test(trimmed)) return trimmed
  return null
}
