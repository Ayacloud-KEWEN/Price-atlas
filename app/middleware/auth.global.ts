export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server || to.path === '/login') return
  // 服务端已对页面做登录校验；这里在客户端导航时再确认会话是否仍有效。
  // 离线时不阻断（允许继续使用本机草稿）。
  const state = useSessionState()
  try {
    await $fetch('/api/auth/me', { credentials: 'same-origin' })
    state.value = 'ok'
  } catch (e: any) {
    if (e?.response?.status === 401) {
      state.value = 'expired'
      if (!to.path.startsWith('/drafts')) return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
  }
})
