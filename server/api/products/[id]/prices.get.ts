import { and, desc, eq, ne } from 'drizzle-orm'

const { observations, merchants } = schema

/** 商品全部价格观察（所有规格）。分析时默认只取已确认的数据，由前端按状态过滤。 */
export default defineEventHandler(async (event) => {
  const productId = uuid.parse(getRouterParam(event, 'id'))
  const db = useDb()
  const rows = await db.select().from(observations)
    .where(and(eq(observations.productId, productId), ne(observations.status, 'void')))
    .orderBy(desc(observations.observedAt))
  const ms = await db.select().from(merchants)
  const mName = new Map(ms.map((m) => [m.id, [m.name, m.storeName].filter(Boolean).join(' · ')]))
  const items = (await presentObservations(rows)).map((r) => ({ ...r, merchantName: r.merchantId ? mName.get(r.merchantId) ?? null : r.merchantNameRaw }))
  return { items }
})
