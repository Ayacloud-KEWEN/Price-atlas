import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const db = useDb()
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.observations).where(eq(schema.observations.merchantId, id))
  if (r!.n) throw httpError(409, `该商家已有 ${r!.n} 条价格记录，无法删除（可改名保留）`)
  await db.delete(schema.merchants).where(eq(schema.merchants.id, id))
  return { ok: true }
})
