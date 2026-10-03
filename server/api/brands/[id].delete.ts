import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const db = useDb()
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.products).where(eq(schema.products.brandId, id))
  if (r!.n) throw httpError(409, `该品牌下还有 ${r!.n} 个商品，无法删除`)
  await db.delete(schema.brands).where(eq(schema.brands.id, id))
  return { ok: true }
})
