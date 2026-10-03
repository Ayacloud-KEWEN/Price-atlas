import { localDb, type LocalRecord } from './useLocalDb'

let started = false
let running = false

/**
 * 同步引擎：仅在应用打开且在线时工作（不依赖浏览器关闭后的后台同步）。
 * - 记录先写入 IndexedDB，服务端确认后才算已同步；
 * - 记录与照片都用客户端唯一 ID，重试不会产生重复数据；
 * - 照片没有全部上传前，记录不会显示为“已同步”。
 */
export function useSyncEngine() {
  const records = useState<LocalRecord[]>('local-records', () => [])
  const online = useState('online', () => true)
  const busy = useState('sync-busy', () => false)
  const toast = useToast()

  async function refresh() {
    try { records.value = await localDb.listRecords() } catch { /* 无 IndexedDB 时保持空 */ }
  }

  const unsyncedCount = computed(() => records.value.filter((r) => r.syncState !== 'synced').length)
  const failedCount = computed(() => records.value.filter((r) => r.syncState === 'failed').length)

  async function setState(rec: LocalRecord, patch: Partial<LocalRecord>) {
    Object.assign(rec, patch, { updatedAt: Date.now() })
    await localDb.putRecord(rec)
    await refresh()
  }

  async function syncOne(id: string) {
    const rec = await localDb.getRecord(id)
    if (!rec || rec.syncState === 'synced') return
    await setState(rec, { syncState: 'syncing', error: undefined })
    try {
      const photos = await localDb.getPhotos(id)
      const res = await api<{ id: string; duplicate: boolean }>('/api/observations', {
        method: 'POST', body: { ...rec.payload, expectedPhotos: photos.length },
      })
      rec.serverId = res.id
      let failed = 0
      let lastError = ''
      for (const p of photos) {
        if (p.state === 'uploaded') continue
        if (!p.blob) { p.state = 'failed'; p.error = '本机照片数据丢失'; await localDb.putPhoto(p); failed++; lastError = p.error; continue }
        p.state = 'uploading'; p.error = undefined
        await localDb.putPhoto(p)
        try {
          const fd = new FormData()
          fd.append('clientId', p.clientId)
          fd.append('observationClientId', rec.clientId)
          fd.append('kind', p.kind)
          fd.append('file', p.blob, p.name || 'photo.jpg')
          await api('/api/attachments', { method: 'POST', body: fd })
          p.state = 'uploaded'; p.blob = null // 服务端确认后才释放本机照片
          await localDb.putPhoto(p)
        } catch (e: any) {
          p.state = 'failed'; p.error = e?.message || '上传失败'
          await localDb.putPhoto(p)
          failed++; lastError = p.error!
          if (e?.status === 401 || e?.network) break // 会话过期/断网，不必继续尝试其余照片
        }
      }
      if (failed) {
        await setState(rec, {
          syncState: 'failed',
          error: `记录已保存到服务器，但有 ${failed} 张照片未上传完整：${lastError}`,
        })
      } else {
        await setState(rec, { syncState: 'synced', error: undefined })
        useMeta().load(true).catch(() => {})
      }
    } catch (e: any) {
      const msg = e?.status === 401 ? '登录已过期，请重新登录后点击重试（本机草稿不会丢失）'
        : e?.network ? '网络不可用，已保留在本机，恢复网络后自动重试'
        : e?.fields && Object.keys(e.fields).length ? `服务器拒绝了该记录：${Object.values(e.fields).join('；')}`
        : `同步失败：${e?.message || e}`
      await setState(rec, { syncState: 'failed', error: msg })
    }
  }

  async function syncAll() {
    if (running || !online.value) return
    running = true; busy.value = true
    try {
      await refresh()
      for (const r of records.value.filter((x) => x.syncState === 'pending')) await syncOne(r.clientId)
    } finally { running = false; busy.value = false }
  }

  /** 用户手动重试 / 立即同步 */
  async function retry(id: string) {
    const rec = await localDb.getRecord(id)
    if (!rec) return
    await setState(rec, { syncState: 'pending', error: undefined, autoQueue: true })
    if (!online.value) { toast.info('当前离线，恢复网络后会自动同步'); return }
    running = false
    await syncOne(id)
  }

  async function hold(id: string) {
    const rec = await localDb.getRecord(id)
    if (rec && rec.syncState !== 'synced') await setState(rec, { syncState: 'local', autoQueue: false })
  }

  async function remove(id: string) {
    await localDb.deleteRecord(id)
    await refresh()
  }

  async function enqueue(rec: LocalRecord) {
    rec.syncState = online.value ? 'pending' : 'local'
    rec.autoQueue = true
    await refresh()
    if (online.value) syncAll()
  }

  function start() {
    if (started || !import.meta.client) return
    started = true
    online.value = navigator.onLine
    refresh().then(() => {
      // 上次未完成（崩溃/关闭）的“同步中”重置为待同步
      Promise.all(records.value.filter((r) => r.syncState === 'syncing').map(async (r) => setState(r, { syncState: 'pending' }))).then(syncAll)
    })
    navigator.storage?.persist?.().catch(() => {})
    window.addEventListener('online', async () => {
      online.value = true
      for (const r of records.value.filter((x) => x.syncState === 'local' && x.autoQueue)) await setState(r, { syncState: 'pending' })
      // 网络类失败自动重试
      for (const r of records.value.filter((x) => x.syncState === 'failed' && /网络不可用/.test(x.error || ''))) await setState(r, { syncState: 'pending' })
      syncAll()
    })
    window.addEventListener('offline', () => { online.value = false })
    setInterval(() => { if (online.value && !running) syncAll() }, 30_000)
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }

  return { records, online, busy, unsyncedCount, failedCount, refresh, syncAll, syncOne, retry, hold, remove, enqueue, start }
}
