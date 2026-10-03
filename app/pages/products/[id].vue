<template>
  <div v-if="loadError" class="card p-6 text-danger">{{ loadError }}</div>
  <div v-else-if="!data" class="text-sm text-muted">加载中…</div>
  <div v-else>
    <NuxtLink to="/products" class="text-xs text-muted hover:underline">← 商品库</NuxtLink>
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold">{{ [data.brand?.name, data.product.name].filter(Boolean).join(' ') }}</h1>
        <p class="text-sm text-muted">{{ data.categoryPath.join(' › ') }}{{ data.product.nameOriginal ? ' · 原文：' + data.product.nameOriginal : '' }}{{ data.product.series ? ' · 系列/型号：' + data.product.series : '' }}</p>
        <div class="mt-1"><span v-for="t in data.tags" :key="t.id" class="chip mr-1">{{ t.name }}</span></div>
      </div>
      <div class="flex gap-2">
        <button class="btn btn-sm" @click="editing = !editing">{{ editing ? '取消编辑' : '编辑商品资料' }}</button>
        <button class="btn btn-sm" @click="showVariant = !showVariant">＋ 新增规格</button>
      </div>
    </div>

    <!-- 编辑商品 -->
    <section v-if="editing" class="card mb-4 space-y-4 p-4">
      <h2 class="section-title">编辑商品资料</h2>
      <p class="hint">修改分类或资料不会改变既有价格记录：每条价格都保存了录入当时的规格与分类快照。</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <div><label class="label" for="pe-cat">品类</label>
          <select id="pe-cat" v-model="pe.categoryId" class="input"><option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.label }}</option></select></div>
        <div><label class="label" for="pe-brand">品牌</label><input id="pe-brand" v-model="pe.brand" class="input" list="pe-brands" />
          <datalist id="pe-brands"><option v-for="b in meta.brands" :key="b.id" :value="b.name" /></datalist></div>
        <div><label class="label" for="pe-name">商品名称</label><input id="pe-name" v-model="pe.name" class="input" :class="{ 'input-error': peErr.name }" /><p v-if="peErr.name" class="err">{{ peErr.name }}</p></div>
        <div><label class="label" for="pe-orig">原文名称</label><input id="pe-orig" v-model="pe.nameOriginal" class="input" /></div>
        <div><label class="label" for="pe-series">型号 / 系列</label><input id="pe-series" v-model="pe.series" class="input" /></div>
        <div><label class="label" for="pe-tags">标签（逗号分隔）</label><input id="pe-tags" v-model="pe.tags" class="input" list="pe-taglist" /><datalist id="pe-taglist"><option v-for="t in meta.tags" :key="t.id" :value="t.name" /></datalist></div>
      </div>
      <AttrFields v-if="productFields.length" :fields="productFields" :model="pe.attrs" @change="(k: string, v: unknown) => (pe.attrs[k] = v)" />
      <div>
        <div class="mb-1 flex items-center justify-between"><span class="label !mb-0">自定义属性</span>
          <button class="btn btn-sm" type="button" @click="pe.customAttrs.push({ name: '', value: '', unit: '' })">＋ 添加</button></div>
        <div v-for="(a, i) in pe.customAttrs" :key="i" class="mb-2 grid grid-cols-[1fr_1fr_6rem_auto] gap-2">
          <input v-model="a.name" class="input" placeholder="属性名" aria-label="属性名" /><input v-model="a.value" class="input" placeholder="值" aria-label="属性值" />
          <input v-model="a.unit" class="input" placeholder="单位" aria-label="单位" /><button class="btn btn-sm btn-danger" type="button" @click="pe.customAttrs.splice(i, 1)">删</button>
        </div>
        <p class="hint">常用的自定义属性可在“基础资料 → 分类与属性”中提升为该品类的正式表单字段。</p>
      </div>
      <p v-if="peMsg" class="err">{{ peMsg }}</p>
      <button class="btn btn-primary" :disabled="busy" @click="saveProduct">保存商品资料</button>
    </section>

    <section v-if="showVariant" class="card mb-4 p-4">
      <h2 class="section-title mb-3">为此商品新增规格</h2>
      <ProductQuickForm :locked-product="{ id: data.product.id, categoryId: data.product.categoryId }" submit-label="添加规格" cancellable :busy="busy"
        :error-msg="vErr" :errors="vErrs" @submit="addVariant" @cancel="showVariant = false" />
    </section>

    <!-- 商品资料 -->
    <section v-if="infoRows.length || data.product.customAttrs.length" class="card mb-4 p-4">
      <h2 class="section-title mb-3">商品资料</h2>
      <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="r in infoRows" :key="r.label"><dt class="text-xs text-muted">{{ r.label }}</dt><dd>{{ r.value }}</dd></div>
        <div v-for="a in data.product.customAttrs" :key="a.name"><dt class="text-xs text-muted">{{ a.name }}（自定义）</dt><dd>{{ a.value }}{{ a.unit ? ' ' + a.unit : '' }}</dd></div>
      </dl>
    </section>

    <!-- 规格列表 -->
    <section class="card mb-4 overflow-x-auto" aria-labelledby="vs">
      <h2 id="vs" class="section-title p-4 pb-2">规格（{{ data.variants.length }}）</h2>
      <table class="tbl min-w-[760px]">
        <thead><tr><th>规格</th><th>条码</th><th>规格专属信息</th><th class="num">已确认报价</th><th></th></tr></thead>
        <tbody>
          <tr v-for="v in data.variants" :key="v.id" :class="selVariant === v.id ? 'bg-brand-50/50' : ''">
            <td><div class="font-medium">{{ specSummary(v) || '未填写规格' }}</div><div v-if="v.isMixedSet" class="chip">混合套装</div></td>
            <td class="text-xs">{{ v.barcode || '—' }}</td>
            <td class="text-xs">{{ variantAttrText(v) }}</td>
            <td class="num">{{ countFor(v.id) }}</td>
            <td class="whitespace-nowrap text-right">
              <button class="btn btn-sm" @click="selVariant = selVariant === v.id ? '' : v.id">{{ selVariant === v.id ? '查看全部规格' : '只看此规格' }}</button>
              <NuxtLink :to="`/capture/price?variantId=${v.id}`" class="btn btn-sm ml-1">记录价格</NuxtLink>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <!-- 价格 -->
    <section class="card mb-4 p-4" aria-labelledby="pr">
      <h2 id="pr" class="section-title mb-1">价格历史</h2>
      <p class="mb-3 text-xs text-muted">不同币种、渠道、零售/批发、价格类型和税费条件分开展示，不跨币种折算。默认只统计“已确认”的记录。样本只是报价，不代表成交价。</p>
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <label class="flex items-center gap-1.5 text-sm"><input v-model="includeUnverified" type="checkbox" class="h-4 w-4 accent-brand" /> 包含未核查记录</label>
        <div><label class="sr-only" for="grp">价格口径</label>
          <select id="grp" v-model="groupKey" class="input !w-auto"><option v-for="g in groups" :key="g.key" :value="g.key">{{ g.label }}（{{ g.items.length }} 条）</option></select></div>
        <div><label class="sr-only" for="met">指标</label>
          <select id="met" v-model="metric" class="input !w-auto"><option v-for="m in metricOptions" :key="m.key" :value="m.key">{{ m.label }}</option></select></div>
      </div>
      <p v-if="!groups.length" class="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">
        {{ pricesLoading ? '加载中…' : (includeUnverified ? '还没有价格记录。' : '还没有已确认的价格记录。待核查的记录可勾选上方“包含未核查记录”查看。') }}
      </p>
      <template v-else-if="curGroup">
        <div class="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>样本 <b>{{ curGroup.items.length }}</b> 条</span>
          <span>渠道 <b>{{ merchantCount }}</b> 个</span>
          <span>覆盖 <b>{{ fmtDate(curGroup.from) }}</b> 至 <b>{{ fmtDate(curGroup.to) }}</b></span>
          <span v-if="stats">最低 <b>{{ fmtMoney(stats.min, curGroup.currency) }}</b> · 最高 <b>{{ fmtMoney(stats.max, curGroup.currency) }}</b> · 中位 <b>{{ fmtMoney(stats.median, curGroup.currency) }}</b>（{{ stats.n }} 个可比样本）</span>
        </div>
        <PriceChart :series="chartSeries" />
        <p v-if="skippedForMetric" class="mt-1 text-xs text-muted">有 {{ skippedForMetric }} 条记录无法换算为“{{ metricLabel }}”，未参与图表与统计。</p>

        <div class="mt-4 overflow-x-auto">
          <table class="tbl min-w-[760px]">
            <thead><tr><th>日期</th><th>规格</th><th>渠道</th><th class="num">原始报价</th><th>单位</th><th class="num">{{ metricLabel }}</th><th>状态</th></tr></thead>
            <tbody>
              <tr v-for="o in curGroup.items" :key="o.id">
                <td class="whitespace-nowrap">{{ fmtDate(o.observedAt) }}</td>
                <td class="text-xs">{{ specSummary(variantMap[o.variantId]) }}</td>
                <td class="text-xs">{{ o.merchantName || '—' }}<div class="text-muted">{{ o.marketCountry }}</div></td>
                <td class="num whitespace-nowrap font-medium"><NuxtLink :to="`/quotes/${o.id}`" class="text-brand hover:underline">{{ fmtMoney(o.amount, o.currency) }}</NuxtLink></td>
                <td class="text-xs">{{ QUOTE_UNITS[o.quoteUnit as keyof typeof QUOTE_UNITS] }}</td>
                <td class="num">{{ metricValue(o) ? fmtMoney(metricValue(o)) : '—' }}</td>
                <td><StatusBadge :status="o.status" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <section class="card p-4" aria-labelledby="hist">
      <h2 id="hist" class="section-title mb-2">资料修改记录</h2>
      <p v-if="!data.history.length" class="text-sm text-muted">暂无。</p>
      <ul class="space-y-2 text-sm">
        <li v-for="h in data.history" :key="h.id"><span class="text-xs text-muted">{{ fmtDate(h.createdAt, true) }}</span> {{ h.action === 'create' ? '创建' : '修改' }}{{ h.note ? '（' + h.note + '）' : '' }}
          <span v-for="(c, k) in h.changes" :key="k" class="ml-2 text-xs">{{ k }}: <s class="text-danger">{{ short(c.from) }}</s> → <b>{{ short(c.to) }}</b></span></li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
import { median, QUOTE_UNITS, METRIC_LABELS, comparabilityKey, type Metric } from '../../../shared/pricing'
import { SALE_TYPES, PRICE_TYPES, TAX_STATUS, CONDITIONS } from '../../../shared/templates'
import type { Series } from '../../components/PriceChart.vue'

const id = String(useRoute().params.id)
const toast = useToast()
const { meta, load, categoryOptions, fieldsFor } = useMeta()

const data = ref<any>(null)
const loadError = ref('')
const prices = ref<any[]>([])
const pricesLoading = ref(true)
const editing = ref(false)
const showVariant = ref(false)
const busy = ref(false)
const vErr = ref(''); const vErrs = ref<Record<string, string>>({})
const peErr = ref<Record<string, string>>({}); const peMsg = ref('')
const pe = reactive({ categoryId: '', brand: '', name: '', nameOriginal: '', series: '', tags: '', attrs: {} as Record<string, any>, customAttrs: [] as any[] })
const selVariant = ref('')
const includeUnverified = ref(false)
const groupKey = ref('')
const metric = ref<'amount' | Metric>('amount')

const short = (v: unknown) => (v == null || v === '' ? '（空）' : typeof v === 'object' ? JSON.stringify(v).slice(0, 60) : String(v))
const productFields = computed(() => fieldsFor(data.value?.product.categoryId).filter((f) => f.level === 'product'))
const variantFields = computed(() => fieldsFor(data.value?.product.categoryId).filter((f) => f.level === 'variant'))
const variantMap = computed<Record<string, any>>(() => Object.fromEntries((data.value?.variants ?? []).map((v: any) => [v.id, v])))

const fmtAttr = (f: any, v: unknown) => (v === true ? '是' : f.options?.find((o: any) => o.value === v)?.label ?? String(v)) + (f.unit ? ` ${f.unit}` : '')
const infoRows = computed(() => productFields.value.filter((f) => data.value.product.attrs?.[f.key] != null && data.value.product.attrs[f.key] !== '')
  .map((f) => ({ label: f.label, value: fmtAttr(f, data.value.product.attrs[f.key]) })))
const variantAttrText = (v: any) => variantFields.value.filter((f) => v.attrs?.[f.key] != null && v.attrs[f.key] !== '' && v.attrs[f.key] !== false)
  .map((f) => `${f.label}：${fmtAttr(f, v.attrs[f.key])}`).join('；') || '—'

async function loadAll() {
  try {
    data.value = await api(`/api/products/${id}`)
    const p = data.value.product
    Object.assign(pe, {
      categoryId: p.categoryId, brand: data.value.brand?.name ?? '', name: p.name, nameOriginal: p.nameOriginal ?? '', series: p.series ?? '',
      tags: data.value.tags.map((t: any) => t.name).join(', '), attrs: { ...(p.attrs ?? {}) }, customAttrs: (p.customAttrs ?? []).map((a: any) => ({ unit: '', ...a })),
    })
    pricesLoading.value = true
    prices.value = (await api<{ items: any[] }>(`/api/products/${id}/prices`)).items
  } catch (e: any) { loadError.value = e.message } finally { pricesLoading.value = false }
}
onMounted(async () => { await load().catch(() => {}); await loadAll() })

async function saveProduct() {
  busy.value = true; peErr.value = {}; peMsg.value = ''
  try {
    const brandName = pe.brand.trim()
    const brand = brandName ? meta.value.brands.find((b: any) => b.name.toLowerCase() === brandName.toLowerCase()) : null
    const attrs: Record<string, any> = {}
    for (const f of productFields.value) {
      let v = pe.attrs[f.key]
      if (v === '' || v == null) continue
      if (f.type === 'number' || f.type === 'year') { const n = Number(String(v).replace(',', '.')); if (!Number.isNaN(n)) v = n }
      attrs[f.key] = v
    }
    await api(`/api/products/${id}`, { method: 'PATCH', body: {
      categoryId: pe.categoryId, brandId: brand?.id ?? null, newBrandName: brand ? null : (brandName || null), name: pe.name.trim(),
      nameOriginal: pe.nameOriginal || null, series: pe.series || null, attrs,
      customAttrs: pe.customAttrs.filter((a) => a.name?.trim() && a.value?.trim()).map((a) => ({ name: a.name.trim(), value: a.value.trim(), ...(a.unit ? { unit: a.unit } : {}) })),
      tags: pe.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    } })
    toast.success('商品资料已保存（保留了修改记录）')
    editing.value = false
    await load(true).catch(() => {}); await loadAll()
  } catch (e: any) { peErr.value = e.fields ?? {}; peMsg.value = e.message } finally { busy.value = false }
}

async function addVariant(payload: { variant: any }) {
  busy.value = true; vErr.value = ''; vErrs.value = {}
  try {
    await api(`/api/products/${id}/variants`, { method: 'POST', body: payload.variant })
    toast.success('已添加规格'); showVariant.value = false; await loadAll()
  } catch (e: any) { vErr.value = e.message; vErrs.value = Object.fromEntries(Object.entries(e.fields ?? {}).map(([k, v]) => [`variant.${k}`, v as string])) } finally { busy.value = false }
}

// ---- 价格分析（仅按条件分组，不跨币种/条件混合） ----
const visible = computed(() => prices.value.filter((o) => (includeUnverified.value ? ['confirmed', 'pending', 'draft'] : ['confirmed']).includes(o.status)
  && o.amount != null && o.currency && (!selVariant.value || o.variantId === selVariant.value)))
const countFor = (vid: string) => prices.value.filter((o) => o.variantId === vid && o.status === 'confirmed').length

const groups = computed(() => {
  const m = new Map<string, any>()
  for (const o of visible.value) {
    const key = comparabilityKey({ currency: o.currency, saleType: o.saleType, priceType: o.priceType, taxStatus: o.taxStatus, condition: o.condition })
    if (!m.has(key)) m.set(key, { key, currency: o.currency, items: [], label: `${o.currency} · ${SALE_TYPES[o.saleType]} · ${PRICE_TYPES[o.priceType]} · ${TAX_STATUS[o.taxStatus]}${o.condition && o.condition !== 'new' ? ' · ' + CONDITIONS[o.condition] : ''}` })
    m.get(key).items.push(o)
  }
  return [...m.values()].map((g) => {
    const ts = g.items.map((o: any) => +new Date(o.observedAt))
    return { ...g, items: g.items.sort((a: any, b: any) => +new Date(b.observedAt) - +new Date(a.observedAt)), from: new Date(Math.min(...ts)), to: new Date(Math.max(...ts)) }
  }).sort((a, b) => b.items.length - a.items.length)
})
watch(groups, (gs) => { if (!gs.find((g) => g.key === groupKey.value)) groupKey.value = gs[0]?.key ?? '' }, { immediate: true })
const curGroup = computed(() => groups.value.find((g) => g.key === groupKey.value))

const metricOptions = computed(() => {
  const opts: { key: 'amount' | Metric; label: string }[] = [{ key: 'amount', label: '原始报价金额' }]
  const items = curGroup.value?.items ?? []
  for (const k of ['perItem', 'per100g', 'perKg', 'per100ml', 'perL'] as Metric[]) if (items.some((o: any) => o.unitPrices?.[k])) opts.push({ key: k, label: METRIC_LABELS[k] })
  return opts
})
watch(metricOptions, (o) => { if (!o.find((x) => x.key === metric.value)) metric.value = 'amount' })
const metricLabel = computed(() => (metric.value === 'amount' ? '原始报价' : METRIC_LABELS[metric.value]))
const metricValue = (o: any): string | null => (metric.value === 'amount' ? null : o.unitPrices?.[metric.value] ?? null)

// 原始报价金额只在报价单位一致时才能画在同一条线上
const usable = computed(() => {
  const items = curGroup.value?.items ?? []
  if (metric.value === 'amount') {
    const units = new Set(items.map((o: any) => `${o.quoteUnit}|${Number(o.quoteQty)}|${o.variantId}`))
    return { rows: units.size > 1 && !selVariant.value ? [] : items, mixed: units.size > 1 }
  }
  return { rows: items.filter((o: any) => metricValue(o)), mixed: false }
})
const skippedForMetric = computed(() => (curGroup.value?.items.length ?? 0) - usable.value.rows.length)
const valueOf = (o: any) => Number(metric.value === 'amount' ? o.amount : metricValue(o))
const merchantCount = computed(() => new Set((curGroup.value?.items ?? []).map((o: any) => o.merchantId ?? o.merchantNameRaw ?? '?')).size)
const stats = computed(() => {
  const vals = usable.value.rows.map((o: any) => String(valueOf(o)))
  if (!vals.length) return null
  const nums = vals.map(Number)
  return { n: vals.length, min: Math.min(...nums).toFixed(2), max: Math.max(...nums).toFixed(2), median: median(vals)! }
})
const chartSeries = computed<Series[]>(() => {
  const by = new Map<string, Series>()
  for (const o of usable.value.rows) {
    const name = o.merchantName || '来源未填'
    if (!by.has(name)) by.set(name, { name, points: [] })
    by.get(name)!.points.push({ t: +new Date(o.observedAt), v: valueOf(o), label: `${fmtDate(o.observedAt)} ${fmtMoney(String(valueOf(o)), curGroup.value?.currency)}` })
  }
  return [...by.values()]
})
</script>
