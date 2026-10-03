<template>
  <div>
    <h1 class="mb-1 text-xl font-semibold">报价列表</h1>
    <p class="mb-4 text-sm text-muted">每次观察都是一条独立记录，不会覆盖历史报价。标准化单价只是派生值，原始金额与单位始终保留。</p>

    <form class="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="reload">
      <div><label class="label" for="f-q">关键词</label><input id="f-q" v-model="f.q" class="input" placeholder="名称 / 品牌 / 备注" /></div>
      <div><label class="label" for="f-cat">品类</label>
        <select id="f-cat" v-model="f.categoryId" class="input"><option value="">全部</option>
          <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.label }}</option></select></div>
      <div><label class="label" for="f-m">商家</label>
        <select id="f-m" v-model="f.merchantId" class="input"><option value="">全部</option>
          <option v-for="m in meta.merchants" :key="m.id" :value="m.id">{{ m.name }}{{ m.storeName ? ' · ' + m.storeName : '' }}</option></select></div>
      <div><label class="label" for="f-c">销售国家 / 市场</label><input id="f-c" v-model="f.country" class="input" /></div>
      <div><label class="label" for="f-cur">币种</label><input id="f-cur" v-model="f.currency" class="input uppercase" maxlength="3" /></div>
      <div><label class="label" for="f-s">状态</label>
        <select id="f-s" v-model="f.status" class="input"><option value="">全部</option>
          <option v-for="(l, k) in BIZ_STATUS" :key="k" :value="k">{{ l }}</option></select></div>
      <div><label class="label" for="f-from">起始日期</label><input id="f-from" v-model="f.from" type="date" class="input" /></div>
      <div><label class="label" for="f-to">截止日期</label><input id="f-to" v-model="f.to" type="date" class="input" /></div>
      <div class="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button class="btn btn-primary">筛选</button>
        <button type="button" class="btn" @click="clear">清除</button>
        <span class="ml-auto text-sm text-muted">共 {{ total }} 条</span>
      </div>
    </form>

    <p v-if="error" class="text-danger">{{ error }}</p>
    <div class="card overflow-x-auto">
      <table class="tbl min-w-[980px]">
        <thead><tr>
          <th>观察日期</th><th>商品 / 现场名称</th><th>商家 · 市场</th><th class="num">原始报价</th><th>报价单位</th>
          <th class="num">标准化单价</th><th>条件</th><th>状态</th><th>更新</th>
        </tr></thead>
        <tbody>
          <tr v-for="o in items" :key="o.id">
            <td class="whitespace-nowrap">{{ fmtDate(o.observedAt) }}</td>
            <td class="max-w-[18rem]">
              <NuxtLink :to="`/quotes/${o.id}`" class="font-medium text-brand hover:underline">{{ o.displayName || '未命名' }}</NuxtLink>
              <div class="truncate text-xs text-muted">{{ o.categoryPath.join(' › ') }}{{ o.snapPackCount || o.snapUnitSize ? ' · ' + specSummary({ packCount: o.snapPackCount, unitSize: o.snapUnitSize, unitSizeUnit: o.snapUnitSizeUnit }) : '' }}</div>
            </td>
            <td><div>{{ o.merchantName || '—' }}</div><div class="text-xs text-muted">{{ [o.marketCountry, o.marketCity].filter(Boolean).join(' · ') || '市场未填' }}</div></td>
            <td class="num whitespace-nowrap font-semibold">{{ fmtMoney(o.amount, o.currency) }}
              <div v-if="o.originalAmount" class="text-xs font-normal text-muted"><s>{{ fmtMoney(o.originalAmount) }}</s></div></td>
            <td class="text-xs">{{ QUOTE_UNITS[o.quoteUnit as keyof typeof QUOTE_UNITS] }}<div v-if="Number(o.quoteQty) !== 1" class="text-muted">× {{ Number(o.quoteQty) }}</div></td>
            <td class="num whitespace-nowrap text-xs">
              <div v-if="o.unitPrices.perItem">每件 {{ fmtMoney(o.unitPrices.perItem) }}</div>
              <div v-if="o.unitPrices.per100g">每100g {{ fmtMoney(o.unitPrices.per100g) }}</div>
              <div v-if="o.unitPrices.per100ml">每100ml {{ fmtMoney(o.unitPrices.per100ml) }}</div>
              <div v-if="o.unitPrices.perL">每升 {{ fmtMoney(o.unitPrices.perL) }}</div>
              <div v-if="!o.unitPrices.computable" class="text-muted">不可换算</div>
              <div v-if="o.currency && o.unitPrices.computable" class="text-muted">{{ o.currency }}</div>
            </td>
            <td class="text-xs">
              {{ SALE_TYPES[o.saleType] }} · {{ PRICE_TYPES[o.priceType] }}<br />
              {{ TAX_STATUS[o.taxStatus] }} · {{ SHIPPING_STATUS[o.shippingStatus] }}<span v-if="o.shippingAmount"> {{ fmtMoney(o.shippingAmount) }}</span>
              <template v-if="o.condition && o.condition !== 'new'"><br />{{ CONDITIONS[o.condition] }}</template>
            </td>
            <td><StatusBadge :status="o.status" /></td>
            <td class="whitespace-nowrap text-xs text-muted">{{ fmtDate(o.updatedAt, true) }}</td>
          </tr>
          <tr v-if="!loading && !items.length"><td colspan="9" class="py-10 text-center text-muted">没有符合条件的报价记录。</td></tr>
        </tbody>
      </table>
    </div>
    <div class="mt-4 flex items-center justify-between text-sm">
      <button class="btn btn-sm" :disabled="offset === 0 || loading" @click="page(-1)">上一页</button>
      <span class="text-muted">第 {{ Math.floor(offset / limit) + 1 }} / {{ Math.max(1, Math.ceil(total / limit)) }} 页</span>
      <button class="btn btn-sm" :disabled="offset + limit >= total || loading" @click="page(1)">下一页</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SALE_TYPES, PRICE_TYPES, TAX_STATUS, SHIPPING_STATUS, CONDITIONS } from '../../../shared/templates'
import { QUOTE_UNITS } from '../../../shared/pricing'

const { meta, load, categoryOptions } = useMeta()
const f = reactive({ q: '', categoryId: '', merchantId: '', country: '', currency: '', status: '', from: '', to: '' })
const items = ref<any[]>([])
const total = ref(0)
const offset = ref(0)
const limit = 40
const loading = ref(false)
const error = ref('')

async function fetchPage() {
  loading.value = true; error.value = ''
  try {
    const q: Record<string, any> = { limit, offset: offset.value }
    for (const [k, v] of Object.entries(f)) if (v) q[k] = k === 'to' ? `${v}T23:59:59` : v
    const r = await api<{ items: any[]; total: number }>('/api/observations', { query: q })
    items.value = r.items; total.value = r.total
  } catch (e: any) { error.value = e.message } finally { loading.value = false }
}
const reload = () => { offset.value = 0; return fetchPage() }
const page = (d: number) => { offset.value = Math.max(0, offset.value + d * limit); fetchPage() }
const clear = () => { Object.keys(f).forEach((k) => ((f as any)[k] = '')); reload() }
onMounted(async () => { await load().catch(() => {}); await fetchPage() })
</script>
