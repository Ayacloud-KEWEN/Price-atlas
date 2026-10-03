import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const productId = uuid.parse(getRouterParam(event, 'id'))
  const body = variantInput.parse(await readBody(event))
  const db = useDb()
  const [p] = await db.select({ id: schema.products.id }).from(schema.products).where(eq(schema.products.id, productId)).limit(1)
  if (!p) throw httpError(404, '商品不存在')
  const [row] = await db.insert(schema.variants).values({ ...body, productId }).returning()
  await writeAudit(db, 'variant', row!.id, 'create', {}, '新增规格')
  return row
})
