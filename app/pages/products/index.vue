<template>
  <div>
    <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">商品库</h1>
      <button class="btn btn-sm btn-primary" @click="showNew = !showNew">{{ showNew ? '收起' : '＋ 新建商品' }}</button>
    </div>
    <p class="mb-4 text-sm text-muted">同系列不同容量、年份、浓度、包装数量的版本是各自独立的规格，不会仅凭名称相似自动合并。</p>

    <section v-if="showNew" class="card mb-4 p-4">
      <ProductQuickForm submit-label="创建商品" cancellable :busy="busy" :error-msg="formErr" :errors="formErrors" @submit="create" @cancel="showNew = false" />
    </section>

    <form class="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" @submit.prevent="reload">
      <div><label class="label" for="q">名称 / 规格 / 条码</label><input id="q" v-model="f.q" class="input" type="search" /></div>
      <div><label class="label" for="cat">品类（含子分类）</label>
        <select id="cat" v-model="f.categoryId" class="input"><option value="">全部</option>
          <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.label }}</option></select></div>
      <div><label class="label" for="brand">品牌</label>
        <select id="brand" v-model="f.brandId" class="input"><option value="">全部</option><option v-for="b in meta.brands" :key="b.id" :value="b.id">{{ b.name }}</option></select></div>
      <div><label class="label" for="tag">标签</label>
        <select id="tag" v-model="f.tagId" class="input"><option value="">全部</option><option v-for="t in meta.tags" :key="t.id" :value="t.id">{{ t.name }}</option></select></div>
      <div class="flex items-end gap-2 lg:col-span-4"><button class="btn btn-primary">筛选</button><button type="button" class="btn" @click="clear">清除</button>
        <span class="ml-auto text-sm text-muted">共 {{ total }} 个商品</span></div>
    </form>

    <p v-if="error" class="text-danger">{{ error }}</p>
    <div class="card overflow-x-auto">
      <table class="tbl min-w-[800px]">
        <thead><tr>
          <th>商品</th><th>品类</th>
          <th v-for="c in extraCols" :key="c.key">{{ c.label }}</th>
          <th class="num">规格数</th><th class="num">已确认报价</th><th>最近观察</th><th>标签</th>
        </tr></thead>
        <tbody>
          <tr v-for="p in items" :key="p.id">
            <td><NuxtLink :to="`/products/${p.id}`" class="font-medium text-brand hover:underline">{{ [p.brand, p.name].filter(Boolean).join(' ') }}</NuxtLink>
              <div v-if="p.nameOriginal || p.series" class="text-xs text-muted">{{ [p.nameOriginal, p.series].filter(Boolean).join(' · ') }}</div></td>
            <td class="text-xs">{{ p.categoryPath.join(' › ') }}</td>
            <td v-for="c in extraCols" :key="c.key" class="text-xs">{{ displayAttr(p.attrs?.[c.key], c) }}</td>
            <td class="num">{{ p.variantCount }}</td><td class="num">{{ p.confirmedCount }}</td>
            <td class="whitespace-nowrap text-xs">{{ fmtDate(p.lastObservedAt) }}</td>
            <td><span v-for="t in p.tags" :key="t.id" class="chip mr-1">{{ t.name }}</span></td>
          </tr>
          <tr v-if="!loading && !items.length"><td :colspan="6 + extraCols.length" class="py-12 text-center text-muted">还没有商品。从手机采集“新商品”，或点击右上角新建。</td></tr>
        </tbody>
      </table>
    </div>
    <button v-if="items.length < total" class="btn mt-3 w-full" :disabled="loading" @click="more">加载更多</button>
  </div>
</template>

<script setup lang="ts">
import type { FieldDef } from '../../../shared/templates'

const { meta, load, categoryOptions, fieldsFor } = useMeta()
const toast = useToast()
const f = reactive({ q: '', categoryId: '', brandId: '', tagId: '' })
const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const showNew = ref(false)
const busy = ref(false)
const formErr = ref('')
const formErrors = ref<Record<string, string>>({})

// 选择具体品类后，展示该品类相关的商品级属性列
const extraCols = computed<FieldDef[]>(() => f.categoryId ? fieldsFor(f.categoryId).filter((x) => x.level === 'product').slice(0, 4) : [])
const displayAttr = (v: unknown, c: FieldDef) => (v == null || v === '' ? '—' : c.options?.find((o) => o.value === v)?.label ?? String(v))

async function fetchPage(reset: boolean) {
  loading.value = true; error.value = ''
  try {
    const q: Record<string, any> = { limit: 60, offset: reset ? 0 : items.value.length }
    for (const [k, v] of Object.entries(f)) if (v) q[k] = v
    const r = await api<{ items: any[]; total: number }>('/api/products', { query: q })
    items.value = reset ? r.items : [...items.value, ...r.items]; total.value = r.total
  } catch (e: any) { error.value = e.message } finally { loading.value = false }
}
const reload = () => fetchPage(true)
const more = () => fetchPage(false)
const clear = () => { Object.keys(f).forEach((k) => ((f as any)[k] = '')); reload() }
onMounted(async () => { await load().catch(() => {}); await fetchPage(true) })

async function create(payload: any) {
  busy.value = true; formErr.value = ''; formErrors.value = {}
  try {
    const r = await api<{ productId: string }>('/api/products', { method: 'POST', body: payload })
    toast.success('已创建商品')
    await navigateTo(`/products/${r.productId}`)
  } catch (e: any) { formErr.value = e.message; formErrors.value = e.fields ?? {} } finally { busy.value = false }
}
</script>
