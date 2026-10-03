import { z } from 'zod'
import { checkLoginAllowed, clearLoginFailures, recordLoginFailure, safeEqual, setSession } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: false }) || 'unknown'
  checkLoginAllowed(ip)
  const body = z.object({ username: z.string().max(100), password: z.string().max(200) }).parse(await readBody(event))
  const user = process.env.ADMIN_USERNAME || 'admin'
  const pass = process.env.ADMIN_PASSWORD
  if (!pass) throw createError({ statusCode: 500, statusMessage: '服务端未配置 ADMIN_PASSWORD' })
  if (!safeEqual(body.username, user) || !safeEqual(body.password, pass)) {
    recordLoginFailure(ip)
    throw createError({ statusCode: 401, statusMessage: '用户名或密码错误' })
  }
  clearLoginFailures(ip)
  setSession(event)
  return { ok: true }
})
