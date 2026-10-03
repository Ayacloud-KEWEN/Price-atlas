import { asc, desc, eq, inArray } from 'drizzle-orm'

const { products, brands, variants, productTags, tags, auditLog } = schema

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const db = useDb()
  const [p] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  if (!p) throw httpError(404, '商品不存在')
  const cats = await loadCategoryMap(db)
  const [brand] = p.brandId ? await db.select().from(brands).where(eq(brands.id, p.brandId)).limit(1) : []
  const vs = await db.select().from(variants).where(eq(variants.productId, id)).orderBy(asc(variants.createdAt))
  const tagRows = await db.select({ id: tags.id, name: tags.name }).from(productTags)
    .innerJoin(tags, eq(productTags.tagId, tags.id)).where(eq(productTags.productId, id))
  const history = await db.select().from(auditLog)
    .where(inArray(auditLog.entityId, [id, ...vs.map((v) => v.id)])).orderBy(desc(auditLog.createdAt)).limit(50)
  // 同品牌 + 同名/系列的其他商品（仅供参考，不自动合并）
  return {
    product: p, brand: brand ?? null, variants: vs, tags: tagRows, history,
    categoryPath: cats.pathOf(p.categoryId), template: cats.templateOf(p.categoryId),
  }
})
