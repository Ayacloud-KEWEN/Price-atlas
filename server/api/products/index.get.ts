import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'

const { products, brands, variants, productTags, tags, observations } = schema

export default defineEventHandler(async (event) => {
  const q = z.object({
    q: z.string().trim().max(100).optional(),
    categoryId: z.string().uuid().optional(),
    brandId: z.string().uuid().optional(),
    tagId: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(60),
    offset: z.coerce.number().int().min(0).default(0),
  }).parse(getQuery(event))
  const db = useDb()
  const cats = await loadCategoryMap(db)

  const where = [
    q.categoryId ? inArray(products.categoryId, cats.descendants(q.categoryId)) : undefined,
    q.brandId ? eq(products.brandId, q.brandId) : undefined,
    q.tagId ? sql`exists (select 1 from product_tags pt where pt.product_id = ${products.id} and pt.tag_id = ${q.tagId})` : undefined,
    q.q ? or(
      ilike(products.name, `%${q.q}%`), ilike(products.nameOriginal, `%${q.q}%`), ilike(products.series, `%${q.q}%`),
      ilike(brands.name, `%${q.q}%`),
      sql`exists (select 1 from variants v where v.product_id = ${products.id} and (v.barcode ilike ${'%' + q.q + '%'} or v.label ilike ${'%' + q.q + '%'} or v.edition ilike ${'%' + q.q + '%'}))`,
    ) : undefined,
  ].filter(Boolean) as any[]

  const rows = await db.select({
    id: products.id, name: products.name, nameOriginal: products.nameOriginal, series: products.series,
    categoryId: products.categoryId, brandId: products.brandId, brand: brands.name, attrs: products.attrs,
    createdAt: products.createdAt,
    variantCount: sql<number>`(select count(*)::int from variants v where v.product_id = ${products.id})`,
    confirmedCount: sql<number>`(select count(*)::int from observations o where o.product_id = ${products.id} and o.status = 'confirmed')`,
    lastObservedAt: sql<string | null>`(select max(o.observed_at) from observations o where o.product_id = ${products.id} and o.status <> 'void')`,
  }).from(products).leftJoin(brands, eq(products.brandId, brands.id))
    .where(and(...where)).orderBy(desc(products.createdAt)).limit(q.limit).offset(q.offset)

  const ids = rows.map((r) => r.id)
  const tagRows = ids.length
    ? await db.select({ productId: productTags.productId, id: tags.id, name: tags.name })
        .from(productTags).innerJoin(tags, eq(productTags.tagId, tags.id)).where(inArray(productTags.productId, ids))
    : []
  const [totalRow] = await db.select({ total: sql<number>`count(*)::int` }).from(products)
    .leftJoin(brands, eq(products.brandId, brands.id)).where(and(...where))
  return {
    total: totalRow!.total,
    items: rows.map((r) => ({
      ...r,
      categoryPath: cats.pathOf(r.categoryId),
      template: cats.templateOf(r.categoryId),
      tags: tagRows.filter((t) => t.productId === r.id).map((t) => ({ id: t.id, name: t.name })),
    })),
  }
})
