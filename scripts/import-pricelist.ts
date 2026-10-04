/**
 * 导入 Pricelist/ 目录中的价格（Auchan 红白葡萄酒/海鲜传单截图 + Intermarché 鱼类原料清单）。
 * 通过应用的 HTTP API 写入，所以与手机同步走同一套校验；记录状态为“待核查”，附上来源截图。
 * 使用确定的 clientId，重复运行不会产生重复记录。
 *
 *   BASE_URL=http://localhost:3000 ADMIN_USERNAME=admin ADMIN_PASSWORD=... npx tsx scripts/import-pricelist.ts
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
const DIR = resolve(process.cwd(), 'Pricelist')
let cookie = ''

async function call(method: string, path: string, body?: any) {
  const headers: Record<string, string> = { cookie }
  let payload: any
  if (body instanceof FormData) payload = body
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(BASE + path, { method, headers, body: payload })
  if (path.endsWith('/login')) cookie = res.headers.get('set-cookie')?.split(';')[0] ?? ''
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* ignore */ }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${json?.statusMessage ?? text} ${JSON.stringify(json?.data?.fields ?? '')}`)
  return json
}

// ---------- 通用 ----------
const NOW = new Date().toISOString()
const TZ = 'Europe/Paris'
const FLYER_UNTIL = '2026-10-03T21:59:59.000Z' // 传单“du 29 septembre au 03 octobre 2026”

await call('POST', '/api/auth/login', { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'dev-password-123' })
const meta = await call('GET', '/api/meta')
const catId = (name: string) => meta.categories.find((c: any) => c.name === name)?.id as string | undefined

const wineCat = catId('葡萄酒')!
let seafoodCat = catId('水产海鲜')
if (!seafoodCat) {
  const food = catId('食品')!
  seafoodCat = (await call('POST', '/api/categories', { name: '水产海鲜', parentId: food, template: null })).id
}

async function ensureMerchant(name: string) {
  const found = meta.merchants.find((m: any) => m.name === name)
  if (found) return found.id as string
  return (await call('POST', '/api/merchants', { name, channelType: 'supermarket', country: 'France', defaultCurrency: 'EUR' })).id as string
}
const auchan = await ensureMerchant('Auchan')
const intermarche = await ensureMerchant('Intermarché')

const images = new Map<string, Buffer>()
const image = async (f: string) => images.get(f) ?? (images.set(f, await readFile(resolve(DIR, f))), images.get(f)!)

let created = 0; let skipped = 0
async function submit(key: string, body: Record<string, any>, img?: string) {
  const clientId = `pricelist-20261004-${key}`
  const r = await call('POST', '/api/observations', {
    clientId, status: 'pending', recordedAt: NOW, observedAt: NOW, timezone: TZ, marketCountry: 'France', channelType: 'supermarket',
    currency: 'EUR', taxStatus: 'unknown', shippingStatus: 'unknown', expectedPhotos: img ? 1 : 0, ...body,
  })
  if (r.duplicate) skipped++; else created++
  if (img && r.photoCount === 0) {
    const fd = new FormData()
    fd.append('clientId', `${clientId}-img`); fd.append('observationClientId', clientId); fd.append('kind', 'price_tag')
    fd.append('file', new Blob([new Uint8Array(await image(img))], { type: 'image/png' }), img)
    await call('POST', '/api/attachments', fd)
  }
}

// ---------- 1) Auchan 葡萄酒（IMG_1448–1452）----------
// 价格含税：法国零售货架价为含税价（TTC）。容量：传单注明“Tous nos vins sont des AOC en bouteille de 75 cl sauf mention contraire”。
type Wine = {
  ref: string; img: string; region: string; color: '红' | '白' | '红/白'; appellation: string; cuvee?: string; producer: string
  year: number | null; price: string; was?: string; promo?: string; note?: string
}
const B = 'Bourgogne · Côte de Beaune'; const BDX = 'Bordeaux'; const RH = 'Vallée du Rhône'
const wines: Wine[] = [
  // IMG_1448 红 · Côte de Beaune
  { ref: '547537', img: 'IMG_1448.PNG', region: B, color: '红', appellation: 'Savigny-lès-Beaune 1er Cru AOP', cuvee: 'Cuvée Fouquerand', producer: 'Hospices de Beaune', year: 2022, price: '96.90', note: '酒标图片上显示 2023，文字标注 2022，按文字录入，请核对' },
  { ref: '311306', img: 'IMG_1448.PNG', region: B, color: '红', appellation: 'Chorey-lès-Beaune AOP', producer: 'Domaine Gay & Fils', year: 2018, price: '15.99' },
  { ref: '243136', img: 'IMG_1448.PNG', region: B, color: '红', appellation: 'Santenay AOP', cuvee: 'Vieilles Vignes', producer: 'Château de Cheilly', year: 2023, price: '19.95' },
  { ref: '494979', img: 'IMG_1448.PNG', region: B, color: '红', appellation: 'Pommard AOP', producer: 'Cyrot Buthiau', year: 2024, price: '28.95' },
  { ref: '612244', img: 'IMG_1448.PNG', region: B, color: '红', appellation: 'Chassagne-Montrachet AOP', cuvee: 'Les Jardins', producer: 'Château de Chassagne Montrachet', year: 2023, price: '32.55' },
  { ref: '705499', img: 'IMG_1448.PNG', region: B, color: '红', appellation: 'Pommard 1er Cru AOP', cuvee: 'Les Épenots', producer: 'Domaine Joillot', year: 2024, price: '49.95' },
  { ref: '311254', img: 'IMG_1448.PNG', region: B, color: '红', appellation: 'Corton Grand Cru AOP', cuvee: 'Le Clos du Roi', producer: 'Domaine Escoffier', year: 2023, price: '59.95' },
  // IMG_1449 Les vins d'exception · Bordeaux
  { ref: '313333', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Saint-Émilion Grand Cru Classé AOP', producer: 'Château Cap de Mourlin', year: 2019, price: '19.95', was: '26.60', promo: '25% 立即折扣 (remise immédiate)' },
  { ref: '310258', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Saint-Émilion Grand Cru Classé AOP', producer: 'Château Fombrauge', year: 2022, price: '27.90' },
  { ref: '341259', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Saint-Émilion Grand Cru Classé AOP', producer: 'Château de Pressac', year: 2020, price: '28.90' },
  { ref: '310565', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Saint-Émilion Grand Cru Classé AOP', producer: 'Château Grand Corbin Despagne', year: 2022, price: '33.90' },
  { ref: '426678', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Saint-Émilion Grand Cru Classé AOP', producer: 'Château la Dominique', year: 2022, price: '47.90' },
  { ref: '869926', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Pomerol AOP', producer: 'Clos René', year: 2024, price: '24.90' },
  { ref: '313348-313362', img: 'IMG_1449.PNG', region: BDX, color: '红/白', appellation: 'Pessac-Léognan AOP', producer: 'Château la Louvière', year: 2023, price: '25.90', note: '传单标注 HVE；“Rouge ou Blanc”同价，未区分红白，请核对' },
  { ref: '869879', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Pessac-Léognan Grand Cru Classé AOP', producer: 'Château Carbonnieux', year: 2024, price: '26.90' },
  { ref: '869878', img: 'IMG_1449.PNG', region: BDX, color: '白', appellation: 'Pessac-Léognan Grand Cru Classé AOP', producer: 'Château Carbonnieux', year: null, price: '31.90', note: '传单仅注明“Existe aussi en Blanc au prix de 31€90”，年份未标注' },
  { ref: '311878', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Pessac-Léognan Grand Cru Classé AOP', producer: 'Château de Fieuzal', year: 2022, price: '36.90' },
  { ref: '30568', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Pessac-Léognan Grand Cru Classé AOP', producer: 'Château Pape Clément', year: 2021, price: '79.00' },
  { ref: '30650', img: 'IMG_1449.PNG', region: BDX, color: '白', appellation: 'Pessac-Léognan Grand Cru Classé AOP', producer: 'Château Pape Clément', year: null, price: '125.00', note: '传单仅注明“Existe en Blanc au prix de 125€”，年份未标注' },
  { ref: '442640', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Margaux AOP', producer: 'Château Siran', year: 2022, price: '31.90' },
  { ref: '341257', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Margaux 5ème Grand Cru Classé AOP', producer: 'Château du Tertre', year: 2020, price: '34.90' },
  { ref: '310465', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Margaux 4ème Grand Cru Classé AOP', producer: 'Château Prieuré Lichine', year: 2022, price: '38.90' },
  { ref: '47727', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Margaux 3ème Grand Cru Classé AOP', producer: 'Château Cantenac Brown', year: 2021, price: '44.90' },
  { ref: '702047', img: 'IMG_1449.PNG', region: BDX, color: '红', appellation: 'Margaux 3ème Grand Cru Classé AOP', producer: 'Château Giscours', year: 2023, price: '54.90' },
  { ref: '313325', img: 'IMG_1449.PNG', region: BDX, color: '白', appellation: 'Sauternes Grand Cru Classé AOP', producer: 'Château la Tour Blanche', year: 2019, price: '49.90', note: '甜白；容量按传单页脚默认 75cl' },
  // IMG_1450 Bordeaux 左岸
  { ref: '869895', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Saint-Julien 4ème Grand Cru Classé AOP', producer: 'Château Talbot', year: 2024, price: '44.90' },
  { ref: '869887', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Haut-Médoc AOP', producer: 'Château Sociando Mallet', year: 2024, price: '24.90' },
  { ref: '312012', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Haut-Médoc 4ème Grand Cru Classé AOP', producer: 'Château la Tour Carnet', year: 2022, price: '29.90' },
  { ref: '946008', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Moulis AOP', producer: 'Château Poujeaux', year: 2019, price: '23.90' },
  { ref: '316183', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Moulis AOP', producer: 'Château Maucaillou', year: 2022, price: '23.90' },
  { ref: '34975', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Moulis AOP', producer: 'Château Branas Grand Poujeaux', year: 2021, price: '24.90' },
  { ref: '702052', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Moulis AOP', producer: 'Château Chasse Spleen', year: 2023, price: '26.90' },
  { ref: '702142', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Saint-Estèphe Grand Cru Classé AOP', producer: 'Château Meyney', year: 2023, price: '24.90' },
  { ref: '542040', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Saint-Estèphe 5ème Grand Cru Classé AOP', producer: 'Château Cos Labory', year: 2021, price: '29.90' },
  { ref: '869942', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Saint-Estèphe AOP', producer: 'Château Haut Marbuzet', year: 2024, price: '29.95' },
  { ref: '702079', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Saint-Estèphe 4ème Grand Cru Classé AOP', producer: 'Château Lafon Rochet', year: 2023, price: '36.90' },
  { ref: '869918', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Saint-Julien AOP', producer: 'Château Gloria', year: 2024, price: '26.90' },
  { ref: '702009', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Saint-Julien 3ème Grand Cru Classé AOP', producer: 'Château Lagrange', year: 2023, price: '45.90' },
  { ref: '427227', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Pauillac 5ème Grand Cru Classé AOP', producer: 'Château Croizet Bages', year: 2022, price: '33.90' },
  { ref: '665658', img: 'IMG_1450.PNG', region: BDX, color: '红', appellation: 'Pauillac 5ème Grand Cru Classé AOP', producer: 'Château Pédesclaux', year: 2016, price: '39.95' },
  // IMG_1451 Vallée du Rhône
  { ref: '312236', img: 'IMG_1451.PNG', region: RH, color: '红', appellation: 'Côte Rôtie AOP', producer: 'Les Frères Lelekstsoglou', year: 2023, price: '64.95' },
  { ref: '39270', img: 'IMG_1451.PNG', region: RH, color: '红', appellation: 'Vacqueyras AOP', producer: 'Domaine de la Libellule', year: 2024, price: '9.99' },
  { ref: '313182', img: 'IMG_1451.PNG', region: RH, color: '红', appellation: 'Cairanne AOP', cuvee: 'Vieilles Vignes', producer: 'Georges Lelektsoglou', year: 2024, price: '14.79' },
  { ref: '547612', img: 'IMG_1451.PNG', region: RH, color: '红', appellation: 'Crozes-Hermitage AOP', cuvee: 'Mule Noire (Bio)', producer: 'Maison Paul Jaboulet Aîné', year: 2021, price: '15.95' },
  { ref: '37076', img: 'IMG_1451.PNG', region: RH, color: '红', appellation: 'Gigondas AOP', cuvee: 'Montagne des Trois yeux', producer: 'Château Redortier', year: 2022, price: '18.90' },
  { ref: '313175', img: 'IMG_1451.PNG', region: RH, color: '红', appellation: 'Saint-Joseph AOP', cuvee: 'Tradition', producer: 'Domaine Courbis', year: 2023, price: '23.49' },
  { ref: '951231', img: 'IMG_1451.PNG', region: RH, color: '红', appellation: 'Châteauneuf-du-Pape AOP', cuvee: 'Réserve Saint Dominique', producer: 'Réserve Saint Dominique', year: 2024, price: '25.95', note: '传单未单独列出生产商，生产商栏按酒款名录入，请核对' },
  // IMG_1452 白 · Côte de Beaune
  { ref: '49249', img: 'IMG_1452.PNG', region: B, color: '白', appellation: 'Ladoix AOP', producer: 'Domaine Chevalier', year: 2023, price: '29.70' },
  { ref: '311739', img: 'IMG_1452.PNG', region: B, color: '白', appellation: 'Santenay AOP', producer: 'Antoine Chevalier Moreau', year: 2021, price: '14.95' },
  { ref: '311854', img: 'IMG_1452.PNG', region: B, color: '白', appellation: 'Chorey-lès-Beaune AOP', producer: 'Domaine Pansiot', year: 2024, price: '19.89' },
  { ref: '854861', img: 'IMG_1452.PNG', region: B, color: '白', appellation: 'Meursault AOP', cuvee: 'Vieilles Vignes', producer: 'Closerie des Alisiers', year: 2023, price: '39.99', was: '45.99', promo: '立减 6€ (remise immédiate)' },
  { ref: '307257', img: 'IMG_1452.PNG', region: B, color: '白', appellation: 'Puligny-Montrachet AOP', cuvee: 'Les Enseignières', producer: 'Domaine Prudhon', year: 2024, price: '46.50' },
  { ref: '109230', img: 'IMG_1452.PNG', region: B, color: '白', appellation: 'Chassagne-Montrachet 1er Cru AOP', cuvee: 'Les Chaumées · Clos de la Truffière', producer: 'Domaine Jouard', year: 2024, price: '59.85' },
  { ref: '42001', img: 'IMG_1452.PNG', region: B, color: '白', appellation: 'Corton Grand Cru AOP', producer: 'Domaine Meuneveaux', year: 2023, price: '78.00' },
]

for (const w of wines) {
  const label = [w.year ?? '年份未标注', '750ml'].join(' · ')
  await submit(`auchan-wine-${w.ref}`, {
    merchantId: auchan, quoteUnit: 'item', saleType: 'retail', taxStatus: 'included',
    priceType: w.was ? 'promo' : 'regular', originalAmount: w.was ?? null, promoCondition: w.promo ?? null,
    amount: w.price, rawName: `${w.producer} ${w.appellation}${w.cuvee ? ' ' + w.cuvee : ''}`, rawSpec: `${w.year ?? ''} 750ml`.trim(),
    notes: [`Auchan 传单 Réf.${w.ref}（来源：${w.img}）`, w.note].filter(Boolean).join('；'),
    tags: ['Auchan传单'],
    newProduct: {
      product: {
        categoryId: wineCat, newBrandName: w.producer, name: [w.appellation, w.cuvee].filter(Boolean).join(' '),
        attrs: { producer: w.producer, country: 'France', region: w.region, appellation: w.appellation, ...(w.cuvee ? { cuvee: w.cuvee } : {}) },
        customAttrs: [{ name: '颜色', value: w.color }], tags: [],
      },
      variant: {
        label, unitSize: '750', unitSizeUnit: 'ml', packCount: 1, edition: '普通装', notes: `Auchan Réf.${w.ref}`,
        attrs: { ...(w.year ? { harvestYear: w.year } : {}) },
      },
    },
  }, w.img)
}

// ---------- 2) Auchan 海鲜（IMG_1453，传单有效期 29/09–03/10/2026）----------
type Fish = { key: string; name: string; spec: string; price: string; unit: 'kg' | 'package'; origin?: string; pack?: [number, string]; note?: string }
const auchanFish: Fish[] = [
  { key: 'saumon', name: '大西洋鲑鱼整条（已去内脏）', spec: '整条 1–3 kg', price: '8.49', unit: 'kg', origin: '挪威养殖', note: 'Saumon Atlantique entier vidé' },
  { key: 'gambas', name: '整只熟虾/解冻生虾 Gambas (Penaeus vannamei)', spec: '30–40 只/kg', price: '8.89', unit: 'kg', origin: '厄瓜多尔养殖', note: 'Gambas entières cuites réfrigérées ou crues décongelées；传单标注 200g 一份 1.78€；2kg 盒装同价/kg' },
  { key: 'turbot', name: '大菱鲆 Turbot', spec: '整条 1–2 kg', price: '17.99', unit: 'kg', origin: '西班牙或葡萄牙养殖' },
  { key: 'lieu', name: '黑线鳕/青鳕背肉 Dos de lieu noir（无刺）', spec: '按 kg 计价', price: '16.99', unit: 'kg', origin: '东北大西洋捕捞', note: '传单标注 125g 一份 2.12€' },
  { key: 'lotte', name: '安康鱼尾 Queue de lotte', spec: '单件 500g–2kg', price: '18.99', unit: 'kg', origin: '东北大西洋捕捞' },
  { key: 'raie', name: '鳐鱼翅 Aile de raie', spec: '按 kg 计价', price: '11.99', unit: 'kg', origin: '东北或西北大西洋捕捞' },
  { key: 'limande', name: '裹粉煎鳎鱼片（Meunière）8 片装', spec: '8 片 × 100g，盒装 800g', price: '8.99', unit: 'package', pack: [8, '100'], origin: '法国加工', note: 'Auchan Le Poissonnier；传单标注每片 1.12€、11.24€/kg' },
  { key: 'moules', name: '布肖贻贝 Moules de bouchot AOP du Mont Saint-Michel', spec: '盒装 2L（1.4kg）', price: '7.99', unit: 'package', pack: [1, '1400'], origin: '法国养殖', note: '传单标注 5.71€/kg；可烹饪前需淘洗' },
]
const fishCat = (extra: Record<string, any> = {}) => ({ categoryId: seafoodCat, tags: ['鱼类原料'], ...extra })
for (const f of auchanFish) {
  await submit(`auchan-fish-${f.key}`, {
    merchantId: auchan, quoteUnit: f.unit, saleType: 'retail', priceType: 'promo', taxStatus: 'included',
    promoCondition: 'Auchan 传单 Halles d\'automne（有效期 2026-09-29 至 2026-10-03）', promoValidUntil: FLYER_UNTIL,
    amount: f.price, rawName: f.name, rawSpec: f.spec, snapUnitSize: f.pack ? f.pack[1] : null, snapUnitSizeUnit: f.pack ? 'g' : null, snapPackCount: f.pack ? f.pack[0] : null,
    notes: ['Auchan 传单 IMG_1453', f.origin ? `产地/来源：${f.origin}` : '', f.note ?? ''].filter(Boolean).join('；'),
    tags: ['Auchan传单', '鱼类原料'],
    newProduct: {
      product: { categoryId: seafoodCat, name: f.name, customAttrs: f.origin ? [{ name: '产地/来源', value: f.origin }] : [], tags: [], newBrandName: f.key === 'limande' ? 'Auchan' : undefined },
      variant: f.pack ? { label: f.spec, unitSize: f.pack[1], unitSizeUnit: 'g', packCount: f.pack[0] } : { label: f.spec },
    },
  }, 'IMG_1453.PNG')
}

// ---------- 3) Intermarché 鱼类原料（price.md）----------
const md = (await readFile(resolve(DIR, 'price.md'), 'utf8')).split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
let i = 0
for (const line of md) {
  // 例：Pavés de Truite   125g*2 6.99EUR  /  Queue de Lotte  800g  13.44EUR
  const m = line.match(/^(.*?)\s+(\d+)\s*g(?:\s*\*\s*(\d+))?\s+([\d.,]+)\s*EUR$/i)
  if (!m) { console.warn('无法解析，已跳过：', line); continue }
  const [, name, grams, count, price] = m
  const n = count ? Number(count) : 1
  i++
  await submit(`intermarche-${String(i).padStart(2, '0')}`, {
    merchantId: intermarche, quoteUnit: n > 1 ? 'package' : 'item', saleType: 'retail', priceType: 'regular',
    amount: price!.replace(',', '.'), rawName: name!.trim(), rawSpec: count ? `${grams}g × ${n}` : `${grams}g`,
    snapUnitSize: grams, snapUnitSizeUnit: 'g', snapPackCount: n,
    notes: `Intermarché 鱼类原料清单（来源：price.md）。观察日期为录入当天，清单本身未标注日期`,
    tags: ['鱼类原料', ...(/\bBIO\b/i.test(name!) ? ['BIO'] : [])],
    newProduct: {
      product: { categoryId: seafoodCat, name: name!.trim(), tags: [] },
      variant: { label: count ? `${grams}g × ${n}` : `${grams}g`, unitSize: grams, unitSizeUnit: 'g', packCount: n },
    },
  })
}

console.log(`完成：新建 ${created} 条价格记录，已存在跳过 ${skipped} 条（状态均为“待核查”，请在收件箱核对）。`)
