<template>
  <div>
    <label class="label" for="vsearch">搜索商品（名称 / 品牌 / 条码）</label>
    <input id="vsearch" v-model="q" class="input" type="search" inputmode="search" placeholder="输入名称或条码，留空显示最近商品" autocomplete="off" />
    <p v-if="offline" class="hint text-warn">离线：仅显示最近缓存的商品，可能不是最新。</p>
    <p v-if="loading" class="hint">搜索中…</p>
    <ul class="mt-3 space-y-2" role="listbox" aria-label="搜索结果">
      <li v-for="r in results" :key="r.variantId">
        <button type="button" class="card block w-full p-3 text-left hover:bg-brand-50" role="option" @click="$emit('select', r)">
          <div class="font-medium">{{ [r.brand, r.productName].filter(Boolean).join(' ') }}</div>
          <div class="text-xs text-muted">{{ specSummary(r) || '未填写规格' }}<span v-if="r.barcode"> · 条码 {{ r.barcode }}</span></div>
          <div class="text-xs text-muted">{{ (r.categoryPath || []).join(' › ') }}<span v-if="r.lastObservedAt"> · 最近记录 {{ fmtDate(r.lastObservedAt) }}</span></div>
        </button>
      </li>
    </ul>
    <p v-if="!loading && !results.length" class="mt-3 rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">
      没有找到匹配的商品。你可以
      <NuxtLink to="/capture/new" class="font-semibold text-brand underline">新建商品</NuxtLink>，或
      <NuxtLink to="/capture/quick" class="font-semibold text-brand underline">先拍下来</NuxtLink>稍后整理。
    </p>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ select: [v: any] }>()
const q = ref('')
const results = ref<any[]>([])
const loading = ref(false)
const offline = ref(false)
let timer: any

async function run() {
  loading.value = true; offline.value = false
  try {
    const rows = await api<any[]>('/api/products/search', { query: { q: q.value || undefined, limit: 20 } })
    results.value = rows
    if (!q.value) localDb.cacheSet('recent-variants', rows)
  } catch (e: any) {
    if (e.network) {
      offline.value = true
      const cached = (await localDb.cacheGet<any[]>('recent-variants')) ?? []
      const needle = q.value.trim().toLowerCase()
      results.value = needle
        ? cached.filter((r) => [r.brand, r.productName, r.nameOriginal, r.barcode, r.label].join(' ').toLowerCase().includes(needle))
        : cached
    }
  } finally { loading.value = false }
}
watch(q, () => { clearTimeout(timer); timer = setTimeout(run, 250) })
onMounted(run)
</script>
