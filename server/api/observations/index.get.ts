import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { z } from 'zod'

const { observations, merchants, attachments } = schema

export default defineEventHandler(async (event) => {
  const q = z.object({
    status: z.string().optional(), // 逗号分隔
    q: z.string().trim().max(100).optional(),
    categoryId: z.string().uuid().optional(),
    merchantId: z.string().uuid().optional(),
    variantId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    country: z.string().max(60).optional(),
    currency: z.string().max(3).optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    unlinked: z.enum(['1']).optional(),
    sort: z.enum(['observed_desc', 'observed_asc', 'recorded_desc']).default('observed_desc'),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }).parse(getQuery(event))
  const db = useDb()
  const cats = await loadCategoryMap(db)
  const statuses = q.status?.split(',').filter((s) => ['draft', 'pending', 'confirmed', 'void'].includes(s))

  const where = [
    statuses?.length ? inArray(observations.status, statuses) : undefined,
    q.categoryId ? inArray(observations.categoryId, cats.descendants(q.categoryId)) : undefined,
    q.merchantId ? eq(observations.merchantId, q.merchantId) : undefined,
    q.variantId ? eq(observations.variantId, q.variantId) : undefined,
    q.productId ? eq(observations.productId, q.productId) : undefined,
    q.country ? ilike(observations.marketCountry, q.country) : undefined,
    q.currency ? eq(observations.currency, q.currency.toUpperCase()) : undefined,
    q.from ? gte(observations.observedAt, new Date(q.from)) : undefined,
    q.to ? lte(observations.observedAt, new Date(q.to)) : undefined,
    q.unlinked ? sql`${observations.variantId} is null` : undefined,
    q.q ? or(
      ilike(observations.rawName, `%${q.q}%`), ilike(observations.rawSpec, `%${q.q}%`),
      ilike(observations.notes, `%${q.q}%`), ilike(observations.merchantNameRaw, `%${q.q}%`),
      sql`${observations.snapshot}->>'name' ilike ${'%' + q.q + '%'}`,
      sql`${observations.snapshot}->>'brand' ilike ${'%' + q.q + '%'}`,
    ) : undefined,
  ].filter(Boolean) as any[]

  const order = q.sort === 'observed_asc' ? asc(observations.observedAt)
    : q.sort === 'recorded_desc' ? desc(observations.recordedAt) : desc(observations.observedAt)
  const rows = await db.select().from(observations).where(and(...where)).orderBy(order).limit(q.limit).offset(q.offset)
  const [totalRow] = await db.select({ total: sql<number>`count(*)::int` }).from(observations).where(and(...where))

  const ms = await db.select().from(merchants)
  const mName = new Map(ms.map((m) => [m.id, [m.name, m.storeName].filter(Boolean).join(' · ')]))
  const ids = rows.map((r) => r.id)
  const firstPhotos = ids.length
    ? await db.select({ observationId: attachments.observationId, id: attachments.id, createdAt: attachments.createdAt })
        .from(attachments).where(inArray(attachments.observationId, ids)).orderBy(asc(attachments.createdAt))
    : []
  const first = new Map<string, string>()
  for (const p of firstPhotos) if (!first.has(p.observationId!)) first.set(p.observationId!, p.id)

  const items = (await presentObservations(rows)).map((r) => ({
    ...r,
    merchantName: r.merchantId ? mName.get(r.merchantId) ?? null : r.merchantNameRaw,
    categoryPath: cats.pathOf(r.categoryId),
    displayName: r.rawName || [(r.snapshot as any)?.brand, (r.snapshot as any)?.name].filter(Boolean).join(' ') || null,
    firstPhotoId: first.get(r.id) ?? null,
  }))
  return { total: totalRow!.total, items }
})
