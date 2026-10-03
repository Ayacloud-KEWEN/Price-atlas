import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

export const SESSION_COOKIE = 'pa_session'

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 16) throw createError({ statusCode: 500, statusMessage: 'SESSION_SECRET 未配置（至少 16 位）' })
  return s
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url')

export function createSessionToken(days = Number(process.env.SESSION_DAYS || 30)) {
  const payload = b64(JSON.stringify({ exp: Date.now() + days * 86400_000, n: randomBytes(8).toString('hex') }))
  return `${payload}.${sign(payload)}`
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!token) return false
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return false
  const expected = sign(payload)
  const a = Buffer.from(sig); const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString())
    return typeof exp === 'number' && exp > Date.now()
  } catch { return false }
}

export function hasSession(event: H3Event) {
  return verifySessionToken(getCookie(event, SESSION_COOKIE))
}

export function setSession(event: H3Event) {
  const days = Number(process.env.SESSION_DAYS || 30)
  setCookie(event, SESSION_COOKIE, createSessionToken(days), {
    httpOnly: true, sameSite: 'lax', path: '/',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: days * 86400,
  })
}

export function safeEqual(a: string, b: string) {
  const ha = createHmac('sha256', 'cmp').update(a).digest()
  const hb = createHmac('sha256', 'cmp').update(b).digest()
  return timingSafeEqual(ha, hb)
}

// 简单的登录失败限流（内存）
const fails = new Map<string, { n: number; until: number }>()
export function checkLoginAllowed(ip: string) {
  const f = fails.get(ip)
  if (f && f.until > Date.now()) {
    throw createError({ statusCode: 429, statusMessage: `登录失败次数过多，请 ${Math.ceil((f.until - Date.now()) / 1000)} 秒后再试` })
  }
}
export function recordLoginFailure(ip: string) {
  const f = fails.get(ip) ?? { n: 0, until: 0 }
  f.n += 1
  if (f.n >= 5) { f.until = Date.now() + 60_000; f.n = 0 }
  fails.set(ip, f)
}
export function clearLoginFailures(ip: string) { fails.delete(ip) }
