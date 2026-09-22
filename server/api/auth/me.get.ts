export default defineEventHandler(async (event) => {
  const session = await getUserSession(event)
  if (!session.user?.email) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
  return { email: session.user.email }
})
