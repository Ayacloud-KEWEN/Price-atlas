/**
 * 端到端验收脚本：对正在运行的服务执行（会写入测试数据，请只在开发库上运行）。
 *   BASE_URL=http://localhost:3000 ADMIN_USERNAME=admin ADMIN_PASSWORD=... npx tsx tests/e2e.ts
 */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'

const BASE = process.env.BASE_URL || 'http://localhost:3000'
let cookie = ''
const results: string[] = []

async function call(method: string, path: string, body?: any, opts: { raw?: boolean; auth?: boolean } = {}) {
  const headers: Record<string, string> = {}
  if (opts.auth !== false && cookie) headers.cookie = cookie
  let payload: any
  if (body instanceof FormData) payload = body
  else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body) }
  const res = await fetch(BASE + path, { method, headers, body: payload, redirect: 'manual' })
  const set = res.headers.get('set-cookie')
  if (set && path.includes('login')) cookie = set.split(';')[0]!
  if (opts.raw) return res
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* 非 JSON */ }
  return { status: res.status, json, text }
}

const ok = async (name: string, fn: () => Promise<void>) => {
  try { await fn(); results.push(`✓ ${name}`); console.log(`✓ ${name}`) }
  catch (e: any) { results.push(`✗ ${name}: ${e.message}`); console.error(`✗ ${name}\n   ${e.message}`) }
}

// 1×1 PNG
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
const now = () => new Date().toISOString()

const base = (extra: any) => ({
  clientId: randomUUID(), status: 'pending', recordedAt: now(), observedAt: now(), timezone: 'Europe/Paris',
  taxStatus: 'unknown', shippingStatus: 'unknown', ...extra,
})

await ok('11. 未登录不能读取业务数据', async () => {
  const r = await call('GET', '/api/observations', undefined, { auth: false })
  assert.equal(r.status, 401)
  const p = await call('GET', '/api/attachments/00000000-0000-0000-0000-000000000000/file', undefined, { auth: false })
  assert.equal(p.status, 401)
  const page = await call('GET', '/products', undefined, { raw: true, auth: false }) as Response
  assert.equal(page.status, 302)
})

await ok('登录', async () => {
  const bad = await call('POST', '/api/auth/login', { username: 'admin', password: 'wrong' })
  assert.equal(bad.status, 401)
  const r = await call('POST', '/api/auth/login', { username: process.env.ADMIN_USERNAME || 'admin', password: process.env.ADMIN_PASSWORD || 'dev-password-123' })
  assert.equal(r.status, 200); assert.ok(cookie)
})

const meta = (await call('GET', '/api/meta')).json
const cat = (name: string) => meta.categories.find((c: any) => c.name === name)?.id as string
const uniq = Date.now().toString(36)
let caviarVariant = ''; let caviarObs = ''; let wineVariant = ''; let perfumeVariant = ''; let earVariant = ''; let earObs = ''

await ok('1. 鱼子酱：新商品 + 报价，单价换算正确（3×30g，120 EUR → 每罐40，每100g 133.33）', async () => {
  const r = await call('POST', '/api/observations', base({
    newProduct: {
      product: { categoryId: cat('鱼子酱'), newBrandName: `测试品牌${uniq}`, name: '西伯利亚鲟鱼子酱', attrs: { speciesZh: '西伯利亚鲟', speciesLatin: 'Acipenser baerii', farmOrigin: '法国', gradeOriginal: 'Royal' }, tags: ['礼品'] },
      variant: { unitSize: '30', unitSizeUnit: 'g', packCount: 3, edition: '礼盒', attrs: { processing: 'malossol' } },
    },
    rawName: '测试鱼子酱', amount: '120', currency: 'EUR', quoteUnit: 'package', saleType: 'retail', priceType: 'regular', marketCountry: 'France',
  }))
  assert.equal(r.status, 200, JSON.stringify(r.json))
  caviarObs = r.json.id
  const d = (await call('GET', `/api/observations/${caviarObs}`)).json
  caviarVariant = d.observation.variantId
  assert.equal(d.observation.unitPrices.perItem, '40.00')
  assert.equal(d.observation.unitPrices.per100g, '133.33')
  assert.equal(d.observation.unitPrices.per100ml, null)
})

await ok('1. 葡萄酒：6×750ml 整箱 90 → 每瓶15，每升20；区分采收/装瓶年份/陈年年数', async () => {
  const r = await call('POST', '/api/observations', base({
    newProduct: {
      product: { categoryId: cat('葡萄酒'), newBrandName: `测试酒庄${uniq}`, name: '赤霞珠', attrs: { producer: '某酒庄', country: '法国', region: '波尔多', grapes: '赤霞珠' } },
      variant: { unitSize: '750', unitSizeUnit: 'ml', packCount: 6, attrs: { harvestYear: 2018, bottlingYear: 2020, ageYears: 2, abv: 13.5 } },
    },
    amount: '90', currency: 'EUR', quoteUnit: 'package', rawName: '测试红酒',
  }))
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const d = (await call('GET', `/api/observations/${r.json.id}`)).json
  wineVariant = d.observation.variantId
  assert.equal(d.observation.unitPrices.perItem, '15.00')
  assert.equal(d.observation.unitPrices.perL, '20.00')
  assert.equal(d.observation.unitPrices.per100g, null)
  const prod = (await call('GET', `/api/products/${d.observation.productId}`)).json
  const v = prod.variants[0]
  assert.equal(v.attrs.harvestYear, 2018); assert.equal(v.attrs.bottlingYear, 2020); assert.equal(v.attrs.ageYears, 2)
})

await ok('1. 香水：50ml 80 EUR → 每100ml 160', async () => {
  const r = await call('POST', '/api/observations', base({
    newProduct: {
      product: { categoryId: cat('香水'), newBrandName: `测试香水牌${uniq}`, name: '夜色' },
      variant: { unitSize: '50', unitSizeUnit: 'ml', attrs: { concentration: 'edp', form: 'regular' } },
    },
    amount: '80', currency: 'EUR', quoteUnit: 'item', rawName: '测试香水',
  }))
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const d = (await call('GET', `/api/observations/${r.json.id}`)).json
  perfumeVariant = d.observation.variantId
  assert.equal(d.observation.unitPrices.per100ml, '160.00')
})

await ok('2. 耳机（无专属字段、无净含量）能保存；不显示每100g', async () => {
  const r = await call('POST', '/api/observations', base({
    newProduct: { product: { categoryId: cat('其他商品'), newBrandName: `测试音频${uniq}`, name: 'XYZ 耳机', customAttrs: [{ name: '颜色', value: '黑色' }, { name: '型号', value: 'XYZ' }] }, variant: {} },
    amount: '120', currency: 'EUR', quoteUnit: 'item', rawName: '耳机',
  }))
  assert.equal(r.status, 200, JSON.stringify(r.json))
  earObs = r.json.id
  const d = (await call('GET', `/api/observations/${earObs}`)).json
  earVariant = d.observation.variantId
  assert.equal(d.observation.unitPrices.perItem, '120.00')
  assert.equal(d.observation.unitPrices.per100g, null); assert.equal(d.observation.unitPrices.per100ml, null)
})

await ok('3. 新增分类与自定义属性，无需改代码，并用于商品', async () => {
  const c = await call('POST', '/api/categories', { name: `咖啡${uniq}`, parentId: cat('食品') })
  assert.equal(c.status, 200, JSON.stringify(c.json))
  const d = await call('POST', '/api/attribute-defs', { categoryId: c.json.id, label: '烘焙度', type: 'enum', options: ['浅', '中', '深'] })
  assert.equal(d.status, 200, JSON.stringify(d.json))
  const m = (await call('GET', '/api/meta')).json
  assert.ok(m.attributeDefs.some((x: any) => x.label === '烘焙度'))
  const r = await call('POST', '/api/observations', base({
    newProduct: { product: { categoryId: c.json.id, name: '埃塞俄比亚豆', attrs: { [`x_${d.json.key}`]: '中' } }, variant: { unitSize: '250', unitSizeUnit: 'g' } },
    amount: '14,5'.replace(',', '.'), currency: 'EUR', quoteUnit: 'item', rawName: '咖啡',
  }))
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const bad = await call('POST', '/api/attribute-defs', { categoryId: c.json.id, label: 'x', type: 'enum' })
  assert.equal(bad.status, 422)
})

await ok('5. 同一商品新增价格保留历史；6. 修正与新观察可区分', async () => {
  const r2 = await call('POST', '/api/observations', base({ variantId: caviarVariant, amount: '110', currency: 'EUR', quoteUnit: 'package', rawName: '测试鱼子酱' }))
  assert.equal(r2.status, 200, JSON.stringify(r2.json))
  const list = (await call('GET', `/api/observations?variantId=${caviarVariant}`)).json
  assert.equal(list.total, 2)
  // 修正第一条
  const patch = await call('PATCH', `/api/observations/${caviarObs}`, { amount: '125' })
  assert.equal(patch.status, 200, JSON.stringify(patch.json))
  assert.equal(patch.json.changes.amount.from, '120.0000')
  const d = (await call('GET', `/api/observations/${caviarObs}`)).json
  assert.ok(d.history.some((h: any) => h.action === 'correct' && h.changes.amount))
  assert.equal((await call('GET', `/api/observations?variantId=${caviarVariant}`)).json.total, 2) // 修正不新增记录
})

await ok('7. 幂等：相同 clientId 重复提交不产生重复记录', async () => {
  const body = base({ variantId: earVariant, amount: '99', currency: 'EUR', quoteUnit: 'item', rawName: '耳机 重试' })
  const a = await call('POST', '/api/observations', body)
  const b = await call('POST', '/api/observations', body)
  assert.equal(a.json.id, b.json.id); assert.equal(b.json.duplicate, true)
  const list = (await call('GET', `/api/observations?variantId=${earVariant}`)).json
  assert.equal(list.total, 2) // 初始 1 + 本次 1
})

await ok('8. 照片：上传、幂等、格式校验、鉴权访问、缺失检测', async () => {
  const body = base({ status: 'draft', rawName: '先拍下来', expectedPhotos: 2 })
  const o = await call('POST', '/api/observations', body)
  assert.equal(o.status, 200, JSON.stringify(o.json))
  const attId = randomUUID()
  const mk = (clientId: string, buf: Buffer, name = 'p.png') => {
    const fd = new FormData(); fd.append('clientId', clientId); fd.append('observationClientId', body.clientId); fd.append('kind', 'price_tag')
    fd.append('file', new Blob([buf]), name); return fd
  }
  const up = await call('POST', '/api/attachments', mk(attId, PNG))
  assert.equal(up.status, 200, up.text)
  const again = await call('POST', '/api/attachments', mk(attId, PNG))
  assert.equal(again.json.duplicate, true); assert.equal(again.json.id, up.json.id)
  const evil = await call('POST', '/api/attachments', mk(randomUUID(), Buffer.from('<?php echo 1; ?> not an image at all'), 'x.png'))
  assert.equal(evil.status, 415)
  const d = (await call('GET', `/api/observations/${o.json.id}`)).json
  assert.equal(d.attachments.length, 1); assert.equal(d.photosMissing, 1)
  const file = await call('GET', `/api/attachments/${up.json.id}/file`, undefined, { raw: true }) as Response
  assert.equal(file.status, 200); assert.equal(file.headers.get('content-type'), 'image/png')
  const anon = await call('GET', `/api/attachments/${up.json.id}/file`, undefined, { raw: true, auth: false }) as Response
  assert.equal(anon.status, 401)
  const noObs = await call('POST', '/api/attachments', (() => { const fd = mk(randomUUID(), PNG); fd.set('observationClientId', randomUUID()); return fd })())
  assert.equal(noObs.status, 409)
})

await ok('10. 多币种 / 零售批发分开；未核查不参与分析；混合套装不拆分', async () => {
  // 同一规格再记一条 USD 与批发价，并全部确认
  const usd = await call('POST', '/api/observations', base({ variantId: caviarVariant, amount: '130', currency: 'USD', quoteUnit: 'package' }))
  const whs = await call('POST', '/api/observations', base({ variantId: caviarVariant, amount: '90', currency: 'EUR', quoteUnit: 'package', saleType: 'wholesale' }))
  for (const id of [usd.json.id, whs.json.id, caviarObs]) {
    const r = await call('PATCH', `/api/observations/${id}`, { status: 'confirmed' })
    assert.equal(r.status, 200, JSON.stringify(r.json))
  }
  const an = (await call('GET', '/api/analysis?metric=per100g')).json
  const keys = an.groups.filter((g: any) => g.variants.some((v: any) => v.variantId === caviarVariant)).map((g: any) => g.key)
  assert.ok(keys.length >= 3, `应分成至少 3 组，实际 ${keys.join(',')}`)
  assert.ok(new Set(an.groups.map((g: any) => g.currency)).size >= 2)
  // 待核查的那条（110 EUR）不应出现在统计里
  const g = an.groups.find((x: any) => x.currency === 'EUR' && x.saleType === 'retail' && x.variants.some((v: any) => v.variantId === caviarVariant))
  assert.equal(g.variants.find((v: any) => v.variantId === caviarVariant).n, 1)
  // 混合套装
  const mixed = await call('POST', '/api/observations', base({
    newProduct: { product: { categoryId: cat('香水'), name: '混合礼盒', newBrandName: `测试香水牌${uniq}` }, variant: { unitSize: '30', unitSizeUnit: 'ml', packCount: 3, isMixedSet: true } },
    amount: '150', currency: 'EUR', quoteUnit: 'package', rawName: '混合礼盒',
  }))
  const md = (await call('GET', `/api/observations/${mixed.json.id}`)).json
  assert.equal(md.observation.unitPrices.perPackage, '150.00'); assert.equal(md.observation.unitPrices.perItem, null); assert.equal(md.observation.unitPrices.per100ml, null)
})

await ok('确认前需关联规格；未知运费不等于免运费；作废保留追溯', async () => {
  const d = await call('POST', '/api/observations', base({ rawName: '未知商品', amount: '10', currency: 'EUR' }))
  assert.equal(d.status, 200, JSON.stringify(d.json))
  const c = await call('PATCH', `/api/observations/${d.json.id}`, { status: 'confirmed' })
  assert.equal(c.status, 422); assert.ok(c.json.data.fields.variantId)
  const det = (await call('GET', `/api/observations/${d.json.id}`)).json
  assert.equal(det.observation.shippingStatus, 'unknown'); assert.equal(det.observation.taxStatus, 'unknown')
  const v = await call('POST', `/api/observations/${d.json.id}/void`, { reason: '测试作废' })
  assert.equal(v.status, 200)
  const det2 = (await call('GET', `/api/observations/${d.json.id}`)).json
  assert.equal(det2.observation.status, 'void'); assert.ok(det2.history.some((h: any) => h.action === 'void'))
  const edit = await call('PATCH', `/api/observations/${d.json.id}`, { amount: '11' })
  assert.equal(edit.status, 409)
})

await ok('草稿可无价格保存；校验错误定位到字段', async () => {
  const draft = await call('POST', '/api/observations', base({ status: 'draft', rawName: '只有名字' }))
  assert.equal(draft.status, 200)
  const bad = await call('POST', '/api/observations', base({ status: 'pending', rawName: 'x' }))
  assert.equal(bad.status, 422)
  assert.ok(bad.json.data.fields.amount); assert.ok(bad.json.data.fields.currency)
})

await ok('疑似重复提示 + 批量改分类', async () => {
  const d = await call('POST', '/api/observations', base({ status: 'draft', rawName: '测试鱼子酱' }))
  const dups = (await call('GET', `/api/observations/${d.json.id}/duplicates`)).json
  assert.ok(dups.variants.some((v: any) => v.variantId === caviarVariant), '应提示可能匹配的规格')
  const b = await call('POST', '/api/observations/bulk', { action: 'setCategory', ids: [d.json.id], categoryId: cat('食品') })
  assert.equal(b.json.updated, 1)
  const b2 = await call('POST', '/api/observations/bulk', { action: 'setStatus', ids: [d.json.id], status: 'pending' })
  assert.equal(b2.json.updated, 0); assert.equal(b2.json.skipped.length, 1)
})

await ok('商品新增规格（同系列不同年份）作为独立规格', async () => {
  const prod = (await call('GET', `/api/products/${(await call('GET', `/api/observations?variantId=${wineVariant}`)).json.items[0].productId}`)).json
  const r = await call('POST', `/api/observations`, base({
    newVariant: { productId: prod.product.id, variant: { unitSize: '750', unitSizeUnit: 'ml', packCount: 6, attrs: { harvestYear: 2019 } } },
    amount: '96', currency: 'EUR', quoteUnit: 'package', rawName: '测试红酒 2019',
  }))
  assert.equal(r.status, 200, JSON.stringify(r.json))
  const after = (await call('GET', `/api/products/${prod.product.id}`)).json
  assert.equal(after.variants.length, 2)
  assert.notEqual(after.variants[0].id, after.variants[1].id)
})

console.log('\n' + results.join('\n'))
const failed = results.filter((r) => r.startsWith('✗'))
console.log(`\n${results.length - failed.length}/${results.length} 通过`)
process.exit(failed.length ? 1 : 0)
