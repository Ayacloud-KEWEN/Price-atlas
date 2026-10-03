import { and, eq, ilike, inArray, ne, or, sql } from 'drizzle-orm'
import { computeUnitPrices } from '../../shared/pricing'
import { getTemplate } from '../../shared/templates'
import { useDb, schema } from './db'

const { categories, brands, tags, products, variants, productTags, merchants, observations, auditLog, attachments } = schema

export type Tx = Parameters<Parameters<ReturnType<typeof useDb>['transaction']>[0]>[0] | ReturnType<typeof useDb>

export function httpError(statusCode: number, statusMessage: string, data?: unknown) {
  return createError({ statusCode, statusMessage, data })
}

export async function loadCategoryMap(db: Tx) {
  const rows = await db.select().from(categories)
  const map = new Map(rows.map((r) => [r.id, r]))
  const pathOf = (id: string | null | undefined): string[] => {
    const out: string[] = []
    let cur = id ? map.get(id) : undefined
    let guard = 0
    while (cur && guard++ < 20) { out.unshift(cur.name); cur = cur.parentId ? map.get(cur.parentId) : undefined }
    return out
  }
  const templateOf = (id: string | null | undefined): string => {
    let cur = id ? map.get(id) : undefined
    let guard = 0
    while (cur && guard++ < 20) { if (cur.template) return cur.template; cur = cur.parentId ? map.get(cur.parentId) : undefined }
    return 'generic'
  }
  const descendants = (id: string): string[] => {
    const out = [id]
    for (const r of rows) if (r.parentId === id) out.push(...descendants(r.id))
    return out
  }
  return { rows, map, pathOf, templateOf, descendants }
}

export async function uncategorizedId(db: Tx) {
  const [row] = await db.select({ id: categories.id }).from(categories).where(eq(categories.systemKey, 'uncategorized')).limit(1)
  return row?.id ?? null
}

export async function upsertTagNames(db: Tx, names: string[]) {
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))]
  const ids: string[] = []
  for (const name of clean) {
    const [found] = await db.select().from(tags).where(sql`lower(${tags.name}) = lower(${name})`).limit(1)
    if (found) { ids.push(found.id); continue }
    const [row] = await db.insert(tags).values({ name }).returning()
    ids.push(row!.id)
  }
  return ids
}

export async function attachTags(db: Tx, productId: string, names: string[]) {
  if (!names.length) return
  const ids = await upsertTagNames(db, names)
  for (const tagId of ids) await db.insert(productTags).values({ productId, tagId }).onConflictDoNothing()
}

export async function resolveBrandId(db: Tx, brandId?: string | null, newBrandName?: string | null) {
  if (brandId) return brandId
  const name = newBrandName?.trim()
  if (!name) return null
  const [found] = await db.select().from(brands).where(sql`lower(${brands.name}) = lower(${name})`).limit(1)
  if (found) return found.id
  const [row] = await db.insert(brands).values({ name }).returning()
  return row!.id
}

export async function createProductWithVariant(db: Tx, input: { product: any; variant: any }) {
  const p = input.product
  const [cat] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, p.categoryId)).limit(1)
  if (!cat) throw httpError(422, '分类不存在')
  const brandId = await resolveBrandId(db, p.brandId, p.newBrandName)
  const [prod] = await db.insert(products).values({
    categoryId: p.categoryId, brandId, name: p.name, nameOriginal: p.nameOriginal, series: p.series,
    attrs: p.attrs ?? {}, customAttrs: p.customAttrs ?? [], notes: p.notes,
  }).returning()
  await attachTags(db, prod!.id, p.tags ?? [])
  const v = input.variant
  const [variant] = await db.insert(variants).values({
    productId: prod!.id, label: v.label, barcode: v.barcode, unitSize: v.unitSize, unitSizeUnit: v.unitSizeUnit,
    packCount: v.packCount, packDescription: v.packDescription, edition: v.edition, isMixedSet: v.isMixedSet ?? false,
    attrs: v.attrs ?? {}, notes: v.notes,
  }).returning()
  await db.insert(auditLog).values({ entityType: 'product', entityId: prod!.id, action: 'create', changes: {}, note: '新建商品与规格' })
  return { productId: prod!.id, variantId: variant!.id }
}

export async function createVariantFor(db: Tx, productId: string, v: any) {
  const [p] = await db.select({ id: products.id }).from(products).where(eq(products.id, productId)).limit(1)
  if (!p) throw httpError(422, '商品不存在')
  const [variant] = await db.insert(variants).values({
    productId, label: v.label, barcode: v.barcode, unitSize: v.unitSize, unitSizeUnit: v.unitSizeUnit,
    packCount: v.packCount, packDescription: v.packDescription, edition: v.edition, isMixedSet: v.isMixedSet ?? false,
    attrs: v.attrs ?? {}, notes: v.notes,
  }).returning()
  await db.insert(auditLog).values({ entityType: 'variant', entityId: variant!.id, action: 'create', changes: {}, note: '新增规格' })
  return variant!.id
}

export async function resolveMerchantId(db: Tx, merchantId?: string | null, newMerchant?: any) {
  if (merchantId) return merchantId
  if (!newMerchant) return null
  const [row] = await db.insert(merchants).values(newMerchant).returning()
  return row!.id
}

/** 生成价格记录的商品/规格快照：之后改商品资料不会改变这条历史记录的含义 */
export async function buildSnapshot(db: Tx, variantId: string) {
  const [v] = await db.select().from(variants).where(eq(variants.id, variantId)).limit(1)
  if (!v) throw httpError(422, '规格不存在')
  const [p] = await db.select().from(products).where(eq(products.id, v.productId)).limit(1)
  const [brand] = p!.brandId ? await db.select().from(brands).where(eq(brands.id, p!.brandId)).limit(1) : []
  const cats = await loadCategoryMap(db)
  return {
    productId: p!.id,
    categoryId: p!.categoryId,
    snapUnitSize: v.unitSize,
    snapUnitSizeUnit: v.unitSizeUnit,
    snapPackCount: v.packCount,
    snapIsMixedSet: v.isMixedSet,
    snapshot: {
      categoryPath: cats.pathOf(p!.categoryId),
      template: cats.templateOf(p!.categoryId),
      brand: brand?.name ?? null,
      name: p!.name,
      nameOriginal: p!.nameOriginal,
      series: p!.series,
      productAttrs: p!.attrs,
      customAttrs: p!.customAttrs,
      variantLabel: v.label,
      barcode: v.barcode,
      edition: v.edition,
      packDescription: v.packDescription,
      variantAttrs: v.attrs,
    } as Record<string, any>,
  }
}

export function diffObjects(before: Record<string, any>, after: Record<string, any>, keys: string[]) {
  const out: Record<string, { from: unknown; to: unknown }> = {}
  const norm = (x: unknown) => (x instanceof Date ? x.toISOString() : x ?? null)
  for (const k of keys) {
    if (!(k in after)) continue
    const a = norm(before[k]); const b = norm(after[k])
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = { from: a, to: b }
  }
  return out
}

export async function writeAudit(db: Tx, entityType: string, entityId: string, action: string, changes: Record<string, any>, note?: string | null) {
  await db.insert(auditLog).values({ entityType, entityId, action, changes, note: note ?? null })
}

/** 附上派生的标准化单价（仅派生值，不替代原始记录） */
export function withDerived<T extends typeof observations.$inferSelect>(o: T) {
  const unitPrices = computeUnitPrices({
    amount: o.amount, quoteUnit: o.quoteUnit, quoteQty: o.quoteQty,
    packCount: o.snapPackCount, unitSize: o.snapUnitSize, unitSizeUnit: o.snapUnitSizeUnit, isMixedSet: o.snapIsMixedSet,
  })
  return { ...o, unitPrices }
}

export const normalizeName = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/[\s\-_.,，。·'’"()（）]+/g, '')

/** 疑似重复项：只提示，由人确认，不自动合并 */
export async function findDuplicates(db: Tx, obsId: string) {
  const [o] = await db.select().from(observations).where(eq(observations.id, obsId)).limit(1)
  if (!o) throw httpError(404, '记录不存在')
  const nameKey = normalizeName(o.rawName ?? (o.snapshot as any)?.name)
  const barcode = (o.snapshot as any)?.barcode as string | undefined

  const variantRows = await db.select({
    variantId: variants.id, productId: products.id, productName: products.name, brandId: products.brandId,
    label: variants.label, barcode: variants.barcode, unitSize: variants.unitSize, unitSizeUnit: variants.unitSizeUnit,
    packCount: variants.packCount, edition: variants.edition, categoryId: products.categoryId,
  }).from(variants).innerJoin(products, eq(variants.productId, products.id))

  const brandRows = await db.select().from(brands)
  const brandName = new Map(brandRows.map((b) => [b.id, b.name]))

  const candidates = variantRows.map((r) => {
    const reasons: string[] = []
    if (barcode && r.barcode && r.barcode === barcode) reasons.push('条码相同')
    const pk = normalizeName(`${brandName.get(r.brandId ?? '') ?? ''}${r.productName}`)
    const pk2 = normalizeName(r.productName)
    if (nameKey && (similar(nameKey, pk) || similar(nameKey, pk2))) reasons.push("名称相似")
    return { ...r, brand: brandName.get(r.brandId ?? '') ?? null, reasons }
  }).filter((c) => c.reasons.length).slice(0, 12)

  const sameObs = nameKey
    ? await db.select().from(observations).where(and(
        ne(observations.id, obsId), ne(observations.status, 'void'),
        o.merchantId ? eq(observations.merchantId, o.merchantId) : sql`true`,
        sql`${observations.observedAt} between ${o.observedAt.toISOString()}::timestamptz - interval '3 days' and ${o.observedAt.toISOString()}::timestamptz + interval '3 days'`,
      ))
    : []
  const similarObservations = sameObs.filter((r) => {
    const k = normalizeName(r.rawName ?? (r.snapshot as any)?.name)
    return k && similar(nameKey, k)
  }).map((r) => ({
    id: r.id, rawName: r.rawName ?? (r.snapshot as any)?.name, amount: r.amount, currency: r.currency,
    observedAt: r.observedAt, status: r.status, samePrice: o.amount != null && r.amount === o.amount,
  })).slice(0, 10)

  return { variants: candidates, observations: similarObservations }
}

export async function photoCounts(db: Tx, ids: string[]) {
  if (!ids.length) return new Map<string, number>()
  const rows = await db.select({ observationId: attachments.observationId, n: sql<number>`count(*)::int` })
    .from(attachments).where(inArray(attachments.observationId, ids)).groupBy(attachments.observationId)
  return new Map(rows.map((r) => [r.observationId!, r.n]))
}

export { getTemplate, ilike, or }

/** 名称相似度：较短名称的字符二元组在较长名称中的覆盖率 ≥ 0.6，或互相包含。仅用于“提示”，不自动合并。 */
export function similar(a: string, b: string) {
  if (!a || !b) return false
  if (a === b || a.includes(b) || b.includes(a)) return Math.min(a.length, b.length) >= 2
  const grams = (s: string) => { const out = new Set<string>(); for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2)); return out }
  const [small, big] = a.length <= b.length ? [grams(a), grams(b)] : [grams(b), grams(a)]
  if (small.size < 2) return false
  let hit = 0
  for (const g of small) if (big.has(g)) hit++
  return hit / small.size >= 0.6
}
