import { asc, desc, eq } from 'drizzle-orm'

const { observations, attachments, auditLog, merchants, variants, products, brands } = schema

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const db = useDb()
  const [row] = await db.select().from(observations).where(eq(observations.id, id)).limit(1)
  if (!row) throw httpError(404, '记录不存在')
  const [o] = await presentObservations([row])
  const cats = await loadCategoryMap(db)
  const files = await db.select({
    id: attachments.id, kind: attachments.kind, mime: attachments.mime, size: attachments.size,
    originalName: attachments.originalName, createdAt: attachments.createdAt,
  }).from(attachments).where(eq(attachments.observationId, id)).orderBy(asc(attachments.createdAt))
  const history = await db.select().from(auditLog)
    .where(eq(auditLog.entityId, id)).orderBy(desc(auditLog.createdAt))
  const [merchant] = row.merchantId ? await db.select().from(merchants).where(eq(merchants.id, row.merchantId)).limit(1) : []
  let variant: any = null
  if (row.variantId) {
    const [v] = await db.select({
      id: variants.id, productId: products.id, productName: products.name, brand: brands.name, label: variants.label,
      edition: variants.edition, barcode: variants.barcode, categoryId: products.categoryId,
    }).from(variants).innerJoin(products, eq(variants.productId, products.id))
      .leftJoin(brands, eq(products.brandId, brands.id)).where(eq(variants.id, row.variantId)).limit(1)
    variant = v ?? null
  }
  return {
    observation: o, attachments: files, history, merchant: merchant ?? null, variant,
    categoryPath: cats.pathOf(row.categoryId),
    template: (row.snapshot as any)?.template ?? cats.templateOf(row.categoryId),
    photosMissing: Math.max(0, row.expectedPhotos - files.length),
  }
})
