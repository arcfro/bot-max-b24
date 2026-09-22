import { findAdmin } from '../../utils/admins'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ email?: string, password?: string }>(event)
  const config = useRuntimeConfig()
  // process.env.ADMINS — актуальный .env на сервере; config.admins мог запечься на билде
  const adminsRaw = String(process.env.ADMINS || config.admins || '')
  const admin = findAdmin(body?.email, body?.password, adminsRaw)
  if (!admin) {
    throw createError({ statusCode: 401, statusMessage: 'Неверный email или пароль' })
  }
  await setUserSession(event, {
    user: { email: admin.email },
  })
  return { ok: true, email: admin.email }
})
