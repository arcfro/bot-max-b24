export type AdminAccount = {
  email: string
  password: string
}

export function parseAdmins(raw: string | undefined | null): AdminAccount[] {
  if (!raw || !String(raw).trim()) return []
  try {
    const parsed = JSON.parse(String(raw)) as unknown
    if (!Array.isArray(parsed)) return []
    const accounts: AdminAccount[] = []
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue
      const email = String((item as { email?: unknown }).email || '').trim().toLowerCase()
      const password = String((item as { password?: unknown }).password ?? '')
      if (!email || !password) continue
      accounts.push({ email, password })
    }
    return accounts
  }
  catch {
    return []
  }
}

export function findAdmin(
  email: string | undefined | null,
  password: string | undefined | null,
  raw: string | undefined | null = process.env.ADMINS,
): AdminAccount | null {
  const normalized = (email || '').trim().toLowerCase()
  const pass = password ?? ''
  if (!normalized || !pass) return null
  return parseAdmins(raw).find(a => a.email === normalized && a.password === pass) ?? null
}
