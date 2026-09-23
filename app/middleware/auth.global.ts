export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login' || to.path === '/miniapp') return
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
