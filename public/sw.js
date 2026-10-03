/* Price Atlas service worker —— 只缓存“应用外壳”和构建产物，永不缓存 /api（业务数据与照片）。
 * 限制：必须至少在线打开过一次才能离线使用；离线时只能录入本机草稿，无法加载服务器数据。 */
const VERSION = 'pa-shell-v1'
const SHELL_KEY = '/__shell'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== VERSION) await caches.delete(k)
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  // 带哈希的构建产物：缓存优先
  if (url.pathname.startsWith('/_nuxt/')) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION)
      const hit = await cache.match(req)
      if (hit) return hit
      const res = await fetch(req)
      if (res.ok) cache.put(req, res.clone())
      return res
    })())
    return
  }

  // 页面导航：网络优先，离线时回退到缓存的外壳
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION)
      try {
        const res = await fetch(req)
        if (res.ok && !res.redirected && res.headers.get('content-type')?.includes('text/html')) cache.put(SHELL_KEY, res.clone())
        return res
      } catch {
        const shell = await cache.match(SHELL_KEY)
        if (shell) return shell
        return new Response('离线中，且尚未缓存应用外壳。请联网打开一次后再离线使用。', { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } })
      }
    })())
  }
})
