/**
 * 演示数据（全部为虚构，仅用于试用界面）。默认不会运行，也不会混入业务库。
 *   DATABASE_URL=... npx tsx scripts/seed-demo.ts --confirm
 * 所有商品名以“【演示】”开头，并带有“演示数据”标签；可用 `--remove` 清理。
 */
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { eq, like, inArray } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import * as s from '../server/db/schema'

const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL 未设置'); process.exit(1) }
const confirm = process.argv.includes('--confirm')
const remove = process.argv.includes('--remove')
if (!confirm && !remove) {
  console.log('这会向数据库写入【虚构】的演示数据。确认请加 --confirm；清理演示数据请加 --remove。')
  process.exit(0)
}

const client = postgres(url, { max: 1, onnotice: () => {} })
const db = drizzle(client, { schema: s })
const PREFIX = '【演示】'

if (remove) {
  const ps = await db.select({ id: s.products.id }).from(s.products).where(like(s.products.name, `${PREFIX}%`))
  const ids = ps.map((p) => p.id)
  if (ids.length) {
    const obs = await db.select({ id: s.observations.id }).from(s.observations).where(inArray(s.observations.productId, ids))
    if (obs.length) await db.delete(s.auditLog).where(inArray(s.auditLog.entityId, obs.map((o) => o.id)))
    await db.delete(s.observations).where(inArray(s.observations.productId, ids))
    await db.delete(s.products).where(inArray(s.products.id, ids))
  }
  await db.delete(s.merchants).where(like(s.merchants.name, `${PREFIX}%`))
  await db.delete(s.brands).where(like(s.brands.name, `${PREFIX}%`))
  console.log(`已清理 ${ids.length} 个演示商品`)
  await client.end(); process.exit(0)
}

const cats = await db.select().from(s.categories)
const cat = (name: string) => cats.find((c) => c.name === name)!.id
const [tag] = await db.insert(s.tags).values({ name: '演示数据' }).onConflictDoNothing().returning()
const tagId = tag?.id ?? (await db.select().from(s.tags).where(eq(s.tags.name, '演示数据')))[0]!.id

const brand = async (name: string, country: string) => (await db.insert(s.brands).values({ name: PREFIX + name, country }).returning())[0]!
const merchant = async (name: string, ch: string, country: string, city: string, cur: string) =>
  (await db.insert(s.merchants).values({ name: PREFIX + name, channelType: ch, country, city, defaultCurrency: cur }).returning())[0]!

const mA = await merchant('虚构精品超市', 'supermarket', 'France', 'Paris', 'EUR')
const mB = await merchant('虚构酒类专卖', 'specialty', 'France', 'Bordeaux', 'EUR')
const mC = await merchant('虚构电商网站', 'ecommerce', 'Germany', 'Berlin', 'EUR')

async function product(categoryId: string, brandId: string, name: string, attrs: any, variant: any) {
  const [p] = await db.insert(s.products).values({ categoryId, brandId, name: PREFIX + name, attrs }).returning()
  await db.insert(s.productTags).values({ productId: p!.id, tagId })
  const [v] = await db.insert(s.variants).values({ productId: p!.id, ...variant }).returning()
  return { p: p!, v: v! }
}
async function obs(pv: { p: any; v: any }, m: any, daysAgo: number, amount: string, over: any = {}) {
  await db.insert(s.observations).values({
    clientId: randomUUID(), status: 'confirmed', variantId: pv.v.id, productId: pv.p.id, categoryId: pv.p.categoryId,
    rawName: pv.p.name, snapshot: { name: pv.p.name, demo: true }, snapUnitSize: pv.v.unitSize, snapUnitSizeUnit: pv.v.unitSizeUnit, snapPackCount: pv.v.packCount,
    merchantId: m.id, marketCountry: m.country, marketCity: m.city, channelType: m.channelType,
    observedAt: new Date(Date.now() - daysAgo * 86400000), recordedAt: new Date(), amount, currency: m.defaultCurrency, quoteUnit: 'package',
    ...over,
  })
}

const b1 = await brand('北海鱼子酱坊', 'France'); const b2 = await brand('虚构酒庄', 'France'); const b3 = await brand('虚构香氛', 'France'); const b4 = await brand('虚构音频', 'Germany')
const caviar = await product(cat('鱼子酱'), b1.id, '西伯利亚鲟鱼子酱', { speciesZh: '西伯利亚鲟', speciesLatin: 'Acipenser baerii', farmOrigin: '法国', gradeOriginal: 'Royal' }, { label: '3 × 30g 礼盒', unitSize: '30', unitSizeUnit: 'g', packCount: 3, edition: '礼盒', attrs: { processing: 'malossol' } })
for (const [d, a] of [[60, '132'], [40, '128'], [20, '120'], [3, '118']] as const) await obs(caviar, mA, d, a)
await obs(caviar, mC, 10, '125', { shippingStatus: 'paid', shippingAmount: '15' })

const w18 = await product(cat('葡萄酒'), b2.id, '赤霞珠', { producer: '虚构酒庄', country: '法国', region: '波尔多' }, { label: '2018 · 6 × 750ml', unitSize: '750', unitSizeUnit: 'ml', packCount: 6, attrs: { harvestYear: 2018, abv: 13.5 } })
const [w19v] = await db.insert(s.variants).values({ productId: w18.p.id, label: '2019 · 6 × 750ml', unitSize: '750', unitSizeUnit: 'ml', packCount: 6, attrs: { harvestYear: 2019, abv: 13 } }).returning()
for (const [d, a] of [[50, '96'], [25, '90'], [5, '92']] as const) await obs(w18, mB, d, a)
await obs({ p: w18.p, v: w19v! }, mB, 5, '84')

const perfume = await product(cat('香水'), b3.id, '夜色 EDP', {}, { label: '50ml EDP', unitSize: '50', unitSizeUnit: 'ml', packCount: 1, attrs: { concentration: 'edp', form: 'regular' } })
for (const [d, a] of [[30, '85'], [2, '80']] as const) await obs(perfume, mA, d, a, { quoteUnit: 'item' })

const ear = await product(cat('其他商品'), b4.id, 'XYZ 无线耳机', {}, { label: '黑色' })
await obs(ear, mC, 14, '129', { quoteUnit: 'item' })
await obs(ear, mC, 1, '120', { quoteUnit: 'item' })

console.log('已写入演示数据（全部虚构，名称以“【演示】”开头）。清理：npx tsx scripts/seed-demo.ts --remove')
await client.end()
