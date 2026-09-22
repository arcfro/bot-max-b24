import { findAdmin } from '../../utils/admins'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, password?: string }>(event)
  const config = useRuntimeConfig()
  const admin = findAdmin(body?.email, body?.password, String(config.admins || process.env.ADMINS || ''))
  if (!admin) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный email или пароль' })
  }
  await setUserSession(event, {
    user: { email: admin.email },
  })
  return { ok: true, email: admin.email }
})
