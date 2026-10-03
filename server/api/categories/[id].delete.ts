import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const db = useDb()
  const [cat] = await db.select().from(schema.categories).where(eq(schema.categories.id, id)).limit(1)
  if (!cat) throw httpError(404, '分类不存在')
  if (cat.systemKey) throw httpError(409, '系统预置分类不能删除')
  const count = (t: any, col: any) => db.select({ n: sql<number>`count(*)::int` }).from(t).where(eq(col, id))
  const [[c], [p], [o]] = await Promise.all([
    count(schema.categories, schema.categories.parentId),
    count(schema.products, schema.products.categoryId),
    count(schema.observations, schema.observations.categoryId),
  ])
  if (c!.n || p!.n || o!.n) {
    throw httpError(409, `该分类下还有 ${c!.n} 个子分类、${p!.n} 个商品、${o!.n} 条记录，请先移走，或改为“归档”`)
  }
  await db.delete(schema.categories).where(eq(schema.categories.id, id))
  return { ok: true }
})
