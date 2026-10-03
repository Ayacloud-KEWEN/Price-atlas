import { eq, sql } from 'drizzle-orm'

const { attachments, observations } = schema

/**
 * 上传一张照片（multipart）。字段：file、clientId（附件的客户端唯一 ID，幂等）、
 * observationClientId 或 observationId、kind。
 */
export default defineEventHandler(async (event) => {
  const parts = await readMultipartFormData(event)
  if (!parts) throw httpError(400, '需要 multipart/form-data')
  const field = (n: string) => parts.find((p) => p.name === n && !p.filename)?.data.toString('utf8').trim()
  const file = parts.find((p) => p.name === 'file' && p.filename !== undefined)
  const clientId = field('clientId')
  if (!clientId || clientId.length < 8 || clientId.length > 80) throw fieldError({ clientId: '缺少客户端附件 ID' })
  const kind = field('kind') || 'other'
  if (!['front', 'back', 'price_tag', 'other'].includes(kind)) throw fieldError({ kind: '照片类型不正确' })
  if (!file) throw fieldError({ file: '缺少照片文件' })
  if (file.data.length > maxUploadBytes()) throw httpError(413, `照片超过 ${process.env.MAX_UPLOAD_MB || 15}MB 上限`)

  const db = useDb()
  // 幂等：同一 clientId 已存在则直接返回
  const [existing] = await db.select().from(attachments).where(eq(attachments.clientId, clientId)).limit(1)
  if (existing) return { id: existing.id, duplicate: true, size: existing.size, sha256: existing.sha256 }

  const obsId = field('observationId')
  const obsClientId = field('observationClientId')
  const [obs] = obsId
    ? await db.select({ id: observations.id }).from(observations).where(eq(observations.id, obsId)).limit(1)
    : obsClientId
      ? await db.select({ id: observations.id }).from(observations).where(eq(observations.clientId, obsClientId)).limit(1)
      : []
  if (!obs) throw httpError(409, '对应的价格记录尚未同步，请先同步记录')

  const [cntRow] = await db.select({ n: sql<number>`count(*)::int` }).from(attachments).where(eq(attachments.observationId, obs.id))
  const n = cntRow!.n
  if (n >= maxPhotosPerRecord()) throw httpError(422, `每条记录最多 ${maxPhotosPerRecord()} 张照片`)

  const kindInfo = sniffImage(file.data)
  if (!kindInfo) throw httpError(415, '仅支持 JPEG / PNG / WebP / HEIC 图片')
  const saved = await saveImage(file.data, kindInfo.ext)
  try {
    const [row] = await db.insert(attachments).values({
      clientId, observationId: obs.id, kind, originalName: (file.filename || '').slice(0, 200) || null,
      storedName: saved.storedName, mime: kindInfo.mime, size: file.data.length, sha256: saved.sha256,
    }).onConflictDoNothing({ target: attachments.clientId }).returning()
    if (!row) {
      await removeStored(saved.storedName)
      const [again] = await db.select().from(attachments).where(eq(attachments.clientId, clientId)).limit(1)
      return { id: again!.id, duplicate: true, size: again!.size, sha256: again!.sha256 }
    }
    await writeAudit(db, 'observation', obs.id, 'attachment', {}, `添加照片（${kind}）`)
    return { id: row.id, duplicate: false, size: row.size, sha256: row.sha256 }
  } catch (e) {
    await removeStored(saved.storedName)
    throw e
  }
})
