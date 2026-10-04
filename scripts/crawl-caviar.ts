/**
 * 一次性：抓取 5 家法国鱼子酱网站的公开商品价格，保存为 JSON（不写数据库）。
 *   npx tsx scripts/crawl-caviar.ts
 * 然后用 scripts/import-caviar.ts 导入。
 *
 * 约定：只读公开商品页/公开接口；遵守各站 robots.txt（不碰购物车/结算/账号/排序参数）；
 * 请求间隔 ≥ 2.5 秒；自带说明性 User-Agent；不登录、不绕过任何限制。仅供个人比价记录。
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const UA = 'PriceAtlas-personal/0.1 (+one-off personal price check)'
const GAP_MS = 2500
let last = 0
async function polite<T>(fn: () => Promise<T>): Promise<T> {
  const wait = last + GAP_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  try { return await fn() } finally { last = Date.now() }
}
const get = (url: string, headers: Record<string, string> = {}) =>
  polite(async () => {
    const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'fr-FR,fr;q=0.9', ...headers }, redirect: 'follow' })
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return res
  })
const getText = async (u: string, h?: Record<string, string>) => (await get(u, h)).text()
const getJson = async <T = any>(u: string, h?: Record<string, string>) => (await get(u, h)).json() as Promise<T>

export interface Offer {
  site: string; brand: string; productName: string; line?: string
  speciesZh?: string; speciesLatin?: string; origin?: string
  grams: number; price: string; was?: string; available: boolean
  url: string; sku?: string; note?: string
}
const offers: Offer[] = []
const skipped: { site: string; name: string; reason: string }[] = []
const log = (s: string) => console.log(s)

const decode = (s: string) => s
  .replace(/&#8211;|&ndash;/g, '–').replace(/&#8217;|&rsquo;|&#039;|&#39;/g, '’').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))

/** 从名称判断品种；只在名称里有明确关键词时才给出 */
function species(text: string): { speciesZh?: string; speciesLatin?: string } {
  const t = text.toLowerCase()
  if (/daurenki/.test(t)) return {} // 杂交品种，不下结论
  if (/ba[eé]r?i{1,2}|baïka|baika/.test(t)) return { speciesZh: '西伯利亚鲟', speciesLatin: 'Acipenser baerii' }
  if (/osci[eè]tre|ossetra|oscietra|gueldenst/.test(t)) return { speciesZh: '俄罗斯鲟', speciesLatin: 'Acipenser gueldenstaedtii' }
  if (/beluga|huso huso/.test(t)) return { speciesZh: '欧洲鳇', speciesLatin: 'Huso huso' }
  if (/s[eé]vruga|sevruga|steluga/.test(t)) return { speciesZh: '闪光鲟', speciesLatin: 'Acipenser stellatus' }
  if (/naccari/.test(t)) return { speciesZh: '亚得里亚鲟', speciesLatin: 'Acipenser naccarii' }
  if (/persicus/.test(t)) return { speciesZh: '波斯鲟', speciesLatin: 'Acipenser persicus' }
  if (/dauricus/.test(t)) return { speciesZh: '达氏鳇', speciesLatin: 'Huso dauricus' }
  return {}
}
const FRENCH = /fran[cç]ais|d['’]aquitaine|aquitaine/i

const parseGrams = (s: string): number | null => {
  const m = s.trim().toLowerCase().match(/^(\d+(?:[.,]\d+)?)\s*(kg|g)$/)
  if (!m) return null
  const n = Number(m[1]!.replace(',', '.'))
  return m[2] === 'kg' ? n * 1000 : n
}

// ---------------- Shopify：Sturia / Petrossian ----------------
async function shopify(host: string, brand: string, site: string, accept: (p: any) => boolean) {
  const data = await getJson<{ products: any[] }>(`https://${host}/products.json?limit=250`)
  log(`${brand}: ${data.products.length} 个商品`)
  for (const p of data.products) {
    if (!accept(p)) continue
    const name = decode(p.title)
    const sp = p.product_type && /^(Acipenser|Huso)/i.test(p.product_type)
      ? { speciesLatin: p.product_type.charAt(0).toUpperCase() + p.product_type.slice(1).toLowerCase(), speciesZh: species(p.product_type).speciesZh }
      : species(name)
    let n = 0
    for (const v of p.variants) {
      const g = parseGrams(String(v.option1 ?? v.title))
      if (!g) { skipped.push({ site, name: `${name} / ${v.title}`, reason: '规格不是明确的克重' }); continue }
      offers.push({
        site, brand, productName: name, ...sp,
        origin: FRENCH.test(name) || brand === 'Sturia' ? '法国' : undefined,
        grams: g, price: Number(v.price).toFixed(2), was: v.compare_at_price ? Number(v.compare_at_price).toFixed(2) : undefined,
        available: !!v.available, url: `https://${host}/products/${p.handle}`, sku: v.sku || undefined,
      })
      n++
    }
    log(`  ${name}: ${n} 个规格`)
  }
}

// ---------------- WooCommerce：Caviar de Neuvic ----------------
async function neuvic() {
  const host = 'https://caviar-de-neuvic.com'
  const list = await getJson<any[]>(`${host}/wp-json/wc/store/v1/products?category=20&per_page=100&_fields=id,name,permalink,prices,is_in_stock,type,short_description,description`)
  log(`Caviar de Neuvic: ${list.length} 个鱼子酱类商品`)
  for (const p of list) {
    const name = decode(p.name)
    if (!/^caviar/i.test(name)) { skipped.push({ site: 'Caviar de Neuvic', name, reason: '非鱼子酱本体' }); continue }
    const base = { site: 'Caviar de Neuvic', brand: 'Caviar de Neuvic', productName: name, ...species(name), origin: '法国（阿基坦）', url: p.permalink as string }
    if (p.type === 'variable') {
      const html = await getText(p.permalink)
      const m = html.match(/data-product_variations="([^"]*)"/)
      if (!m) { skipped.push({ site: 'Caviar de Neuvic', name, reason: '页面未包含规格数据' }); continue }
      const vars = JSON.parse(decode(m[1]!)) as any[]
      let n = 0
      for (const v of vars) {
        const w = Object.values(v.attributes as Record<string, string>).map((x) => parseGrams(String(x))).find(Boolean)
        if (!w || !v.display_price) { skipped.push({ site: 'Caviar de Neuvic', name: `${name} / ${JSON.stringify(v.attributes)}`, reason: '规格无法识别克重' }); continue }
        offers.push({ ...base, grams: w, price: Number(v.display_price).toFixed(2), was: v.display_regular_price && v.display_regular_price !== v.display_price ? Number(v.display_regular_price).toFixed(2) : undefined, available: !!v.is_in_stock, sku: v.sku || undefined })
        n++
      }
      log(`  ${name}: ${n} 个规格`)
    } else {
      // 单品：只在名称或简介里写明克重时才录入，避免猜测
      const text = decode(`${p.name} ${p.short_description ?? ''}`).replace(/<[^>]+>/g, ' ')
      const wm = text.match(/(\d+(?:[.,]\d+)?)\s*(g|kg)\b/i)
      const g = wm ? parseGrams(wm[1] + wm[2]) : null
      if (!g) { skipped.push({ site: 'Caviar de Neuvic', name, reason: '单品页未写明克重，未录入' }); continue }
      offers.push({ ...base, grams: g, price: (Number(p.prices.price) / 100).toFixed(2), available: !!p.is_in_stock })
      log(`  ${name}: 1 个规格（${g}g）`)
    }
  }
}

// ---------------- PrestaShop：Kaviari ----------------
async function kaviari() {
  const root = 'https://kaviari.com/fr/nos-caviars'
  const html = await getText(root)
  const links = [...new Set([...html.matchAll(/href="(https:\/\/kaviari\.com\/fr\/nos-caviars\/[a-z0-9-]+)(?:#[^"]*)?"/g)].map((m) => m[1]!))]
  log(`Kaviari: 发现 ${links.length} 个商品页`)
  for (const url of links) {
    const page = await getText(url)
    const ld = [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => { try { return JSON.parse(m[1]!) } catch { return null } })
    const prod = ld.find((j) => j?.['@type'] === 'Product')
    const labels = [...page.matchAll(/<span class="radio-label">([^<]*)<\/span>/g)].map((m) => m[1]!.trim())
    const grams = [...new Set(labels)].map(parseGrams)
    const name = decode(prod?.name ?? url)
    const os = (Array.isArray(prod?.offers) ? prod.offers : prod?.offers ? [prod.offers] : []) as any[]
    if (!prod || !os.length || grams.some((g) => !g) || grams.length !== os.length) {
      skipped.push({ site: 'Kaviari', name, reason: `规格/报价数量对不上（规格 ${grams.length}，报价 ${os.length}），未录入` }); continue
    }
    // 规格选项与报价按页面顺序一一对应；用“每克单价一致”做交叉验证
    const per = os.map((o, i) => Number(o.price) / grams[i]!)
    const consistent = per.every((x) => Math.abs(x - per[0]!) / per[0]! < 0.15)
    os.forEach((o, i) => offers.push({
      site: 'Kaviari', brand: 'Kaviari', productName: name, ...species(name), origin: FRENCH.test(name) ? '法国' : undefined,
      grams: grams[i]!, price: Number(o.price).toFixed(2), available: /InStock/.test(o.availability ?? ''), url, sku: o.sku,
      note: consistent ? undefined : '规格与报价按页面顺序对应，每克单价不一致，请核对',
    }))
    log(`  ${name}: ${os.length} 个规格${consistent ? '' : '（单价不一致，已备注）'}`)
  }
}

// ---------------- PrestaShop：Prunier ----------------
async function prunier() {
  const links = new Set<string>()
  for (const page of [1, 2, 3]) {
    const html = await getText(`https://prunier.com/fr/12-caviars${page > 1 ? `?page=${page}` : ''}`)
    const found = [...html.matchAll(/href="(https:\/\/prunier\.com\/fr\/caviars[a-z0-9-]*\/\d+-[a-z0-9-]+\.html)"/g)].map((m) => m[1]!)
    const before = links.size
    found.forEach((l) => links.add(l))
    if (links.size === before && page > 1) break
  }
  // 同一 id 的重复链接只保留一个
  const byId = new Map<string, string>()
  for (const l of links) byId.set(l.match(/\/(\d+)-/)![1]!, l)
  log(`Prunier: 发现 ${byId.size} 个鱼子酱商品页`)
  const onlyIds = process.env.PRUNIER_IDS?.split(',')
  for (const [id, url] of byId) {
    if (onlyIds && !onlyIds.includes(id)) continue
    let page: string
    try { page = await getText(url) } catch (e: any) { skipped.push({ site: 'Prunier', name: url, reason: `商品页无法打开：${e.message}` }); continue }
    const dm = page.match(/id="product-details" data-product="([^"]*)"/)
    const dp = dm ? JSON.parse(decode(dm[1]!)) : null
    const name = decode(dp?.name ?? url)
    const token = page.match(/static_token":"([a-f0-9]+)"/)?.[1]
    const radios = [...page.matchAll(/name="(group\[(\d+)\])"[^>]*type="radio"[^>]*value="(\d+)"[\s\S]*?<span class="radio-label[^"]*">([^<]*)<\/span>/g)]
      .map((m) => ({ group: m[2]!, value: m[3]!, grams: parseGrams(m[4]!.trim()), label: m[4]!.trim() }))
    const desc = decode(dp?.description ?? '')
    const base = { site: 'Prunier', brand: 'Prunier', productName: name, ...species(`${name} ${/Acipenser\s+(\w+)/i.exec(desc)?.[0] ?? ''}`), origin: /Aquitaine|français/i.test(`${name} ${desc}`) ? '法国（阿基坦）' : undefined, url }
    if (!radios.length) {
      const g = parseGrams((name.match(/(\d+(?:[.,]\d+)?)\s*(g|kg)\b/i) ?? []).slice(1, 3).join(''))
      if (!g || !dp) { skipped.push({ site: 'Prunier', name, reason: '无规格选项且名称未写明克重，未录入' }); continue }
      offers.push({ ...base, grams: g, price: String(dp.price).replace(/[^\d,]/g, '').replace(',', '.'), available: dp.available_for_order === '1' })
      log(`  ${name}: 1 个规格`)
      continue
    }
    let n = 0
    for (const r of radios) {
      if (!r.grams) { skipped.push({ site: 'Prunier', name: `${name} / ${r.label}`, reason: '规格不是明确的克重' }); continue }
      const body = new URLSearchParams({ ajax: '1' })
      const res = await polite(() => fetch(`https://prunier.com/fr/index.php?controller=product&token=${token}&id_product=${id}&id_customization=0&group%5B${r.group}%5D=${r.value}&qty=1&action=refresh`, {
        method: 'POST', headers: { 'user-agent': UA, 'x-requested-with': 'XMLHttpRequest', accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' }, body,
      }))
      const j = (await res.json()) as any
      const html = String(j.product_prices ?? '')
      const price = html.match(/itemprop="price"\s+content="([\d.]+)"/)?.[1] ?? html.match(/content="([\d.]+)"\s+itemprop="price"/)?.[1]
      if (!price) { skipped.push({ site: 'Prunier', name: `${name} / ${r.label}`, reason: '未能读到价格' }); continue }
      const was = html.match(/regular-price[^>]*>\s*([\d\s,]+)/)?.[1]?.replace(/\s/g, '').replace(',', '.')
      offers.push({ ...base, grams: r.grams, price: Number(price).toFixed(2), was: was && Number(was) > Number(price) ? Number(was).toFixed(2) : undefined, available: !/OutOfStock/i.test(html) })
      n++
    }
    log(`  ${name}: ${n} 个规格`)
  }
}

const sites: [string, () => Promise<void>][] = [
  ['Sturia', () => shopify('www.sturia.com', 'Sturia', 'Sturia', (p) => /^(IGP\s+)?Caviar\b/i.test(p.title) && !/pressé/i.test(p.title))],
  ['Petrossian', () => shopify('www.petrossian.fr', 'Petrossian', 'Petrossian', (p) => p.product_type === 'CAVIAR' && /^Caviar\b/i.test(p.title))],
  ['Caviar de Neuvic', neuvic],
  ['Kaviari', kaviari],
  ['Prunier', prunier],
]
const only = process.env.ONLY
const prev = only ? JSON.parse(await (await import('node:fs/promises')).readFile(resolve(process.cwd(), 'data-import/caviar-prices-2026-10-04.json'), 'utf8')) : null
for (const [name, fn] of sites) {
  if (only && name !== only) continue
  try { await fn() } catch (e: any) { console.error(`✗ ${name} 失败：${e.message}`); skipped.push({ site: name, name: '(整站)', reason: `抓取失败：${e.message}` }) }
}

const out = resolve(process.cwd(), 'data-import')
await mkdir(out, { recursive: true })
const file = resolve(out, 'caviar-prices-2026-10-04.json')
if (prev) {
  offers.unshift(...prev.offers.filter((o: Offer) => !(o.site === only && o.productName && offers.some((n) => n.site === o.site && n.productName === o.productName))))
  skipped.unshift(...prev.skipped.filter((x: any) => x.site !== only))
}
await writeFile(file, JSON.stringify({ crawledAt: new Date().toISOString(), offers, skipped }, null, 2))
const bySite: Record<string, number> = {}
for (const o of offers) bySite[o.site] = (bySite[o.site] ?? 0) + 1
console.log(`\n共 ${offers.length} 条报价，跳过 ${skipped.length} 项 → ${file}`)
console.log(bySite)
