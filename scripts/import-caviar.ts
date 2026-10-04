/**
 * 把 scripts/crawl-caviar.ts 抓到的 JSON 导入应用（经 HTTP API，状态“待核查”）。幂等：重复运行不会重复入库。
 *   BASE_URL=http://<地址>:8500 ADMIN_PASSWORD=... npx tsx scripts/import-caviar.ts
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Offer } from './crawl-caviar'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const FILE = resolve(process.cwd(), 'data-import/caviar-prices-2026-10-04.json')
let cookie = ''

async function call(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { cookie }
  let payload: any
  if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(BASE + path, { method, headers, body: payload })
  if (path.endsWith('/login')) cookie = res.headers.get('set-cookie')?.split(';')[0] ?? ''
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* ignore */ }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json?.statusMessage ?? text} ${JSON.stringify(json?.data?.fields ?? '')}`)
  return json
}

const { crawledAt, offers } = JSON.parse(await readFile(FILE, 'utf8')) as { crawledAt: string; offers: Offer[] }

await call('POST', '/api/auth/login', { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'dev-password-123' })
const meta = await call('GET', '/api/meta')
const caviarCat = meta.categories.find((c: any) => c.name === '鱼子酱')?.id as string
if (!caviarCat) throw new Error('找不到“鱼子酱”分类')

const HOME: Record<string, string> = {
  Sturia: 'https://www.sturia.com/', Petrossian: 'https://www.petrossian.fr/', 'Caviar de Neuvic': 'https://caviar-de-neuvic.com/',
  Kaviari: 'https://kaviari.com/fr', Prunier: 'https://prunier.com/',
}
const merchants = new Map<string, string>()
for (const site of Object.keys(HOME)) {
  const found = meta.merchants.find((m: any) => m.name === site)
  merchants.set(site, found?.id ?? (await call('POST', '/api/merchants', {
    name: site, channelType: 'official', url: HOME[site], country: 'France', defaultCurrency: 'EUR',
  })).id)
}

const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const GRADE = /(Tsar Impérial|Spécial Réserve|Royal|Prestige|Jasmin|Classic|Vintage|Origin|Primeur|Grand Cru|Signature|Réserve|Nano|Tradition|Saint-James|Classique|Supérieur|Héritage|Noir Intense|Gold|Impérial|Biologique|Kristal)/i

const groups = new Map<string, Offer[]>()
for (const o of offers) groups.set(`${o.site}|${o.productName}`, [...(groups.get(`${o.site}|${o.productName}`) ?? []), o])

let created = 0; let skipped = 0
for (const [key, list] of groups) {
  let productId: string | null = null
  for (const o of list.sort((a, b) => a.grams - b.grams)) {
    const sixPack = /six bo[iî]tes/i.test(o.productName) // 6 盒装：单价与同系列每克价一致，按“6×克重”录入
    const clientId = `caviar-20261004-${slug(o.site)}-${slug(o.productName)}-${o.grams}`
    const grade = o.productName.match(GRADE)?.[0]
    const variant = {
      label: sixPack ? `6 × ${o.grams}g` : `${o.grams}g`, unitSize: String(o.grams), unitSizeUnit: 'g', packCount: sixPack ? 6 : 1,
      edition: /bo[iî]te origine/i.test(o.productName) ? 'Boîte Origine' : null,
      attrs: /press[ée]/i.test(o.productName) ? { processing: 'pressed' } : {},
      notes: o.sku ? `SKU ${o.sku}` : null,
    }
    const body: Record<string, any> = {
      clientId, status: 'pending', recordedAt: crawledAt, observedAt: crawledAt, timezone: 'Europe/Paris',
      merchantId: merchants.get(o.site), marketCountry: 'France', channelType: 'official',
      amount: o.price, currency: 'EUR', quoteUnit: sixPack ? 'package' : 'item', saleType: 'retail',
      priceType: o.was ? 'promo' : 'regular', originalAmount: o.was ?? null, promoCondition: o.was ? '官网划线原价' : null,
      taxStatus: 'included', shippingStatus: 'unknown', stockStatus: o.available ? 'in_stock' : 'out',
      sourceUrl: o.url, rawName: `${o.brand} ${o.productName} ${variant.label}`, rawSpec: variant.label,
      notes: ['官网公开页面抓取（2026-10-04，一次性）', o.available ? '' : '抓取时缺货/不可订', sixPack ? '6 盒装，按 6×克重录入（依据：每克单价与同系列一致），请核对' : '', o.note ?? ''].filter(Boolean).join('；'),
      tags: ['官网抓取'],
    }
    if (productId) body.newVariant = { productId, variant }
    else body.newProduct = {
      product: {
        categoryId: caviarCat, newBrandName: o.brand, name: o.productName,
        attrs: { ...(o.speciesZh ? { speciesZh: o.speciesZh } : {}), ...(o.speciesLatin ? { speciesLatin: o.speciesLatin } : {}), ...(o.origin ? { farmOrigin: o.origin } : {}), ...(grade ? { gradeOriginal: grade } : {}) },
        tags: [],
      },
      variant,
    }
    const r = await call('POST', '/api/observations', body)
    r.duplicate ? skipped++ : created++
    if (!productId) productId = (await call('GET', `/api/observations/${r.id}`)).observation.productId
  }
}
console.log(`完成：${groups.size} 个商品，新建 ${created} 条价格记录，已存在跳过 ${skipped} 条（状态均为“待核查”）。`)
