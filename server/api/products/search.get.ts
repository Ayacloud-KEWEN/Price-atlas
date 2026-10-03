import { desc, eq, ilike, or, sql } from 'drizzle-orm'
import { z } from 'zod'

const { products, brands, variants } = schema

/** 采集页使用：按名称/条码搜索商品规格；无关键词时返回最近记录过价格的规格 */
export default defineEventHandler(async (event) => {
  const { q, limit, variantId } = z.object({
    q: z.string().trim().max(100).optional(),
    variantId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }).parse(getQuery(event))
  const db = useDb()
  const cats = await loadCategoryMap(db)
  const like = q ? `%${q}%` : null

  const base = db.select({
    variantId: variants.id, productId: products.id, productName: products.name, nameOriginal: products.nameOriginal,
    series: products.series, brand: brands.name, categoryId: products.categoryId,
    label: variants.label, barcode: variants.barcode, edition: variants.edition,
    unitSize: variants.unitSize, unitSizeUnit: variants.unitSizeUnit, packCount: variants.packCount,
    packDescription: variants.packDescription, isMixedSet: variants.isMixedSet,
    lastObservedAt: sql<string | null>`(select max(o.observed_at) from observations o where o.variant_id = ${variants.id} and o.status <> 'void')`,
    lastObservationId: sql<string | null>`(select o.id from observations o where o.variant_id = ${variants.id} and o.status <> 'void' order by o.observed_at desc limit 1)`,
  }).from(variants).innerJoin(products, eq(variants.productId, products.id)).leftJoin(brands, eq(products.brandId, brands.id))

  const rows = variantId
    ? await base.where(eq(variants.id, variantId)).limit(1)
    : like
    ? await base.where(or(
        ilike(products.name, like), ilike(products.nameOriginal, like), ilike(products.series, like), ilike(brands.name, like),
        ilike(variants.barcode, like), ilike(variants.label, like),
      )).orderBy(desc(sql`coalesce((select max(o.observed_at) from observations o where o.variant_id = ${variants.id}), '1970-01-01')`)).limit(limit)
    : await base.orderBy(desc(sql`coalesce((select max(o.observed_at) from observations o where o.variant_id = ${variants.id}), '1970-01-01')`)).limit(limit)

  return rows.map((r) => ({ ...r, categoryPath: cats.pathOf(r.categoryId), template: cats.templateOf(r.categoryId) }))
})
