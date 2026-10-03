import { hasSession } from '../utils/auth'

const PUBLIC_API = new Set(['/api/auth/login', '/api/health'])
const PUBLIC_STATIC = [/^\/_nuxt\//, /^\/__nuxt/, /^\/icon\.svg$/, /^\/manifest\.webmanifest$/, /^\/sw\.js$/, /^\/favicon\.ico$/]

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const method = event.method

  // CSRF 兜底：写操作若带 Origin，必须与 Host 同源
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const origin = getHeader(event, 'origin')
    const host = getHeader(event, 'host')
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) throw createError({ statusCode: 403, statusMessage: '跨站请求被拒绝' })
      } catch (e: any) { if (e?.statusCode) throw e; throw createError({ statusCode: 403, statusMessage: '非法 Origin' }) }
    }
  }

  if (path.startsWith('/api/')) {
    if (PUBLIC_API.has(path)) return
    if (!hasSession(event)) throw createError({ statusCode: 401, statusMessage: '未登录或会话已过期' })
    return
  }
  if (PUBLIC_STATIC.some((r) => r.test(path))) return
  if (path === '/login') return
  if (!hasSession(event)) {
    // 页面同样需要登录；SPA 外壳不含业务数据
    return sendRedirect(event, '/login', 302)
  }
})
