<template>
  <div>
    <h1 class="mb-1 text-xl font-semibold">价格分析</h1>
    <div class="mb-4 rounded-lg border border-line bg-surface p-3 text-sm text-muted">
      <ul class="list-disc space-y-0.5 pl-5">
        <li>仅统计“已确认”且已关联规格的记录；未核查、草稿、已作废记录不参与。</li>
        <li>这是<b>报价统计</b>，不是成交均价（没有销量数据）。</li>
        <li>不同币种、零售/批发、价格类型、税费状态分组展示，不做汇率换算。</li>
        <li>每一行是<b>同一规格</b>的样本；同组内不同规格之间仅作“同类参考”，单位价格相同不代表品质或产品等价。不同年份的酒、不同浓度的香水是不同规格。</li>
      </ul>
    </div>

    <form class="card mb-4 grid gap-3 p-4 sm:grid-cols-3" @submit.prevent="run">
      <div><label class="label" for="a-cat">品类（含子分类）</label>
        <select id="a-cat" v-model="f.categoryId" class="input"><option value="">全部（不同品类不混合平均）</option>
          <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.label }}</option></select></div>
      <div><label class="label" for="a-m">比较指标</label>
        <select id="a-m" v-model="f.metric" class="input"><option v-for="(l, k) in METRIC_LABELS" :key="k" :value="k">{{ l }}</option></select></div>
      <div><label class="label" for="a-c">币种（可选）</label><input id="a-c" v-model="f.currency" class="input uppercase" maxlength="3" /></div>
      <div class="sm:col-span-3"><button class="btn btn-primary" :disabled="loading">{{ loading ? '计算中…' : '查看' }}</button></div>
    </form>

    <p v-if="error" class="text-danger">{{ error }}</p>
    <div v-if="res">
      <p class="mb-3 text-sm text-muted">
        已确认记录 {{ res.totalConfirmed }} 条；其中 {{ res.excludedCount }} 条无法换算为“{{ METRIC_LABELS[res.metric as keyof typeof METRIC_LABELS] }}”（规格不完整或不可比），已排除，不参与排名。
      </p>
      <div v-if="!res.groups.length" class="card p-10 text-center text-sm text-muted">没有符合条件的可比样本。确认一些已关联规格的价格记录后再来看看。</div>
      <section v-for="g in res.groups" :key="g.key" class="card mb-4 overflow-x-auto">
        <header class="border-b border-line p-4">
          <h2 class="section-title">{{ g.currency }} · {{ SALE_TYPES[g.saleType] }} · {{ PRICE_TYPES[g.priceType] }} · {{ TAX_STATUS[g.taxStatus] }}<template v-if="g.condition && g.condition !== 'new'"> · {{ CONDITIONS[g.condition] }}</template></h2>
          <p class="text-xs text-muted">样本 {{ g.sampleCount }} 条 · {{ g.variantCount }} 个规格 · {{ g.merchantCount }} 个渠道 · 覆盖 {{ fmtDate(g.dateFrom) }} 至 {{ fmtDate(g.dateTo) }}</p>
          <p v-if="g.sampleCount < 3" class="mt-1 text-xs text-warn">样本很少，仅供参考。</p>
        </header>
        <table class="tbl min-w-[720px]">
          <thead><tr><th>商品 · 规格（同款样本）</th><th class="num">样本数</th><th class="num">最低</th><th class="num">中位</th><th class="num">最高</th><th class="num">最近一次</th><th>最近日期</th></tr></thead>
          <tbody>
            <tr v-for="v in g.variants" :key="v.variantId">
              <td><NuxtLink :to="`/products/${productOf(v)}`" class="font-medium text-brand hover:underline">{{ [v.brand, v.productName].filter(Boolean).join(' ') }}</NuxtLink>
                <div class="text-xs text-muted">{{ [v.edition, v.label].filter(Boolean).join(' · ') || '—' }}</div></td>
              <td class="num">{{ v.n }}</td>
              <td class="num">{{ fmtMoney(v.min) }}</td><td class="num font-medium">{{ fmtMoney(v.median) }}</td><td class="num">{{ fmtMoney(v.max) }}</td>
              <td class="num">{{ fmtMoney(v.latest) }}</td><td class="text-xs">{{ fmtDate(v.latestAt) }}</td>
            </tr>
          </tbody>
        </table>
        <p class="p-3 text-xs text-muted">金额单位：{{ g.currency }} / {{ METRIC_LABELS[g.metric as keyof typeof METRIC_LABELS] }}。按中位数从低到高排列，仅为同类参考。</p>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SALE_TYPES, PRICE_TYPES, TAX_STATUS, CONDITIONS } from '../../shared/templates'
import { METRIC_LABELS } from '../../shared/pricing'

const { load, categoryOptions } = useMeta()
const f = reactive({ categoryId: '', metric: 'perItem', currency: '' })
const res = ref<any>(null)
const loading = ref(false)
const error = ref('')
// variantId -> productId 查询由接口顺带返回
const productOf = (v: any) => v.productId

async function run() {
  loading.value = true; error.value = ''
  try {
    res.value = await api('/api/analysis', { query: { categoryId: f.categoryId || undefined, metric: f.metric, currency: f.currency || undefined } })
  } catch (e: any) { error.value = e.message } finally { loading.value = false }
}
onMounted(async () => { await load().catch(() => {}); await run() })
</script>
