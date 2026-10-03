import { openDB, type IDBPDatabase } from 'idb'

export type SyncState = 'local' | 'pending' | 'syncing' | 'synced' | 'failed'

export interface LocalPhoto {
  clientId: string
  recordId: string
  kind: 'front' | 'back' | 'price_tag' | 'other'
  name: string
  size: number
  mime: string
  state: 'queued' | 'uploading' | 'uploaded' | 'failed'
  error?: string
  blob?: Blob | null
}

export interface LocalRecord {
  clientId: string
  createdAt: number
  updatedAt: number
  mode: 'existing' | 'new' | 'quick'
  title: string
  subtitle?: string
  /** 表单完整状态，用于离线后继续编辑 */
  form: any
  /** 发送给服务端的载荷 */
  payload: Record<string, any>
  syncState: SyncState
  /** 离线保存后，恢复联网时自动加入同步队列 */
  autoQueue: boolean
  error?: string
  serverId?: string
  photoCount: number
}

// 数据库版本只增不减；升级函数只新增存储，绝不清空已有的未同步草稿
const DB_VERSION = 1
let dbPromise: Promise<IDBPDatabase> | null = null

function db() {
  if (!import.meta.client) throw new Error('IndexedDB 仅在浏览器中可用')
  dbPromise ??= openDB('price-atlas', DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('records', { keyPath: 'clientId' })
        const photos = d.createObjectStore('photos', { keyPath: 'clientId' })
        photos.createIndex('byRecord', 'recordId')
        d.createObjectStore('cache', { keyPath: 'key' })
      }
    },
  })
  return dbPromise
}

export class StorageError extends Error {
  quota: boolean
  constructor(message: string, quota = false) { super(message); this.quota = quota }
}

const wrapWrite = async <T>(fn: () => Promise<T>): Promise<T> => {
  try { return await fn() } catch (e: any) {
    const quota = e?.name === 'QuotaExceededError' || /quota/i.test(String(e?.message))
    throw new StorageError(quota ? '本机存储空间不足，未能保存。请清理手机空间后重试（输入内容仍保留在页面上）' : `本机存储失败：${e?.message || e}`, quota)
  }
}

export const localDb = {
  async saveRecord(rec: LocalRecord, photos: LocalPhoto[]) {
    return wrapWrite(async () => {
      const d = await db()
      const tx = d.transaction(['records', 'photos'], 'readwrite')
      await tx.objectStore('records').put(JSON.parse(JSON.stringify(rec)))
      const existing = await tx.objectStore('photos').index('byRecord').getAllKeys(rec.clientId)
      const keep = new Set(photos.map((p) => p.clientId))
      for (const k of existing) if (!keep.has(k as string)) await tx.objectStore('photos').delete(k)
      for (const p of photos) await tx.objectStore('photos').put(p)
      await tx.done
    })
  },
  async putRecord(rec: LocalRecord) {
    return wrapWrite(async () => { await (await db()).put('records', JSON.parse(JSON.stringify(rec))) })
  },
  async getRecord(id: string): Promise<LocalRecord | undefined> { return (await db()).get('records', id) },
  async listRecords(): Promise<LocalRecord[]> {
    const all = (await (await db()).getAll('records')) as LocalRecord[]
    return all.sort((a, b) => b.createdAt - a.createdAt)
  },
  async deleteRecord(id: string) {
    const d = await db()
    const tx = d.transaction(['records', 'photos'], 'readwrite')
    await tx.objectStore('records').delete(id)
    for (const k of await tx.objectStore('photos').index('byRecord').getAllKeys(id)) await tx.objectStore('photos').delete(k)
    await tx.done
  },
  async getPhotos(recordId: string): Promise<LocalPhoto[]> {
    return (await (await db()).getAllFromIndex('photos', 'byRecord', recordId)) as LocalPhoto[]
  },
  async putPhoto(p: LocalPhoto) { return wrapWrite(async () => { await (await db()).put('photos', p) }) },
  async cacheSet(key: string, value: unknown) {
    try { await (await db()).put('cache', { key, value, at: Date.now() }) } catch { /* 缓存失败不影响主流程 */ }
  },
  async cacheGet<T = any>(key: string): Promise<T | undefined> {
    try { return ((await (await db()).get('cache', key)) as any)?.value } catch { return undefined }
  },
}
