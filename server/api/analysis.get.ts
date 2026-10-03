import { and, eq, inArray, isNotNull } from 'drizzle-orm'
import Decimal from 'decimal.js'
import { z } from 'zod'
import { comparabilityKey, median, type Metric } from '../../shared/pricing'

const { observations, variants, products, brands, merchants } = schema

/**
 * 基础分析：仅使用“已确认”且已关联规格的记录；不可计算该指标的样本被排除并计数。
 * 分组键 = 币种 + 零售/批发 + 价格类型 + 税费 + 新旧状态，不同组不合并、不跨币种。
 * 这是“报价统计”，不是成交均价（没有销量数据）。
 */
export default defineEventHandler(async (event) => {
  const q = z.object({
    categoryId: z.string().uuid().optional(),
    metric: z.enum(['perItem', 'per100g', 'perKg', 'per100ml', 'perL']).default('perItem'),
    currency: z.string().max(3).optional(),
  }).parse(getQuery(event))
  const db = useDb()
  const cats = await loadCategoryMap(db)

  const rows = await db.select().from(observations).where(and(
    eq(observations.status, 'confirmed'), isNotNull(observations.variantId), isNotNull(observations.amount), isNotNull(observations.currency),
    q.categoryId ? inArray(observations.categoryId, cats.descendants(q.categoryId)) : undefined,
    q.currency ? eq(observations.currency, q.currency.toUpperCase()) : undefined,
  ))
  const items = await presentObservations(rows)
  const vInfo = await db.select({
    id: variants.id, label: variants.label, edition: variants.edition, productId: products.id, productName: products.name, brand: brands.name,
  }).from(variants).innerJoin(products, eq(variants.productId, products.id)).leftJoin(brands, eq(products.brandId, brands.id))
  const vMap = new Map(vInfo.map((v) => [v.id, v]))

  let excluded = 0
  const groups = new Map<string, { meta: any; obs: any[] }>()
  for (const o of items) {
    const metricValue = (o.unitPrices as any)[q.metric] as string | null
    if (!metricValue) { excluded++; continue }
    const key = comparabilityKey({ currency: o.currency!, saleType: o.saleType, priceType: o.priceType, taxStatus: o.taxStatus, condition: o.condition })
    if (!groups.has(key)) {
      groups.set(key, { meta: { currency: o.currency, saleType: o.saleType, priceType: o.priceType, taxStatus: o.taxStatus, condition: o.condition ?? null }, obs: [] })
    }
    groups.get(key)!.obs.push({ ...o, metricValue })
  }

  const out = [...groups.entries()].map(([key, g]) => {
    const byVariant = new Map<string, any[]>()
    for (const o of g.obs) byVariant.set(o.variantId, [...(byVariant.get(o.variantId) ?? []), o])
    const merchantsSet = new Set(g.obs.map((o) => o.merchantId ?? o.merchantNameRaw ?? '?'))
    const dates = g.obs.map((o) => new Date(o.observedAt).getTime())
    const variantRows = [...byVariant.entries()].map(([vid, list]) => {
      const vals = list.map((o) => o.metricValue as string)
      const sorted = [...list].sort((a, b) => +new Date(b.observedAt) - +new Date(a.observedAt))
      const nums = vals.map((v) => new Decimal(v))
      const v = vMap.get(vid)
      return {
        variantId: vid, productId: v?.productId, productName: v?.productName, brand: v?.brand, label: v?.label, edition: v?.edition,
        n: list.length,
        min: Decimal.min(...nums).toFixed(2), max: Decimal.max(...nums).toFixed(2), median: median(vals),
        latest: sorted[0].metricValue, latestAt: sorted[0].observedAt,
      }
    }).sort((a, b) => new Decimal(a.median!).cmp(b.median!))
    return {
      key, ...g.meta, metric: q.metric,
      sampleCount: g.obs.length, variantCount: byVariant.size, merchantCount: merchantsSet.size,
      dateFrom: new Date(Math.min(...dates)).toISOString(), dateTo: new Date(Math.max(...dates)).toISOString(),
      variants: variantRows,
    }
  }).sort((a, b) => b.sampleCount - a.sampleCount)

  const ms = await db.select({ id: merchants.id }).from(merchants)
  return { metric: q.metric, groups: out, excludedCount: excluded, totalConfirmed: items.length, merchantCount: ms.length }
})
