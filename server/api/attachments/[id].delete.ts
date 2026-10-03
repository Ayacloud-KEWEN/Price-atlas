import { eq } from 'drizzle-orm'

const { attachments, observations } = schema

// 已确认记录的来源凭证不可删除；草稿/待核查阶段可删除误传照片
export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const db = useDb()
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1)
  if (!row) throw httpError(404, '照片不存在')
  if (row.observationId) {
    const [o] = await db.select({ status: observations.status }).from(observations).where(eq(observations.id, row.observationId)).limit(1)
    if (o && (o.status === 'confirmed' || o.status === 'void')) throw httpError(409, '已确认/已作废记录的来源凭证需保留，不能删除')
    await writeAudit(db, 'observation', row.observationId, 'attachment', {}, `删除照片（${row.kind}）`)
  }
  await db.delete(attachments).where(eq(attachments.id, id))
  await removeStored(row.storedName)
  return { ok: true }
})
