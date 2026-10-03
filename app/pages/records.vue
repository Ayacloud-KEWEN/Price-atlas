<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="mb-3 text-xl font-semibold">记录</h1>
    <div class="mb-3 flex gap-2">
      <input v-model="q" type="search" class="input" placeholder="搜索名称、商家、备注" aria-label="搜索记录" />
      <select v-model="status" class="input !w-32" aria-label="状态筛选">
        <option value="">全部状态</option>
        <option v-for="(l, k) in BIZ_STATUS" :key="k" :value="k">{{ l }}</option>
      </select>
    </div>
    <p v-if="error" class="text-sm text-danger">{{ error }}</p>
    <div v-else-if="!loading && !items.length" class="card p-8 text-center text-sm text-muted">没有符合条件的记录。</div>
    <ul class="space-y-2">
      <li v-for="o in items" :key="o.id">
        <NuxtLink :to="`/quotes/${o.id}`" class="card flex gap-3 p-3 hover:bg-brand-50">
          <img v-if="o.firstPhotoId" :src="`/api/attachments/${o.firstPhotoId}/file`" alt="" class="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" />
          <div v-else class="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-bg text-xs text-muted">无照片</div>
          <div class="min-w-0 flex-1">
            <div class="truncate font-medium">{{ o.displayName || '未命名' }}</div>
            <div class="truncate text-xs text-muted">{{ o.merchantName || '未填来源' }} · {{ fmtDate(o.observedAt) }}</div>
            <div class="mt-1 flex items-center gap-2">
              <StatusBadge :status="o.status" />
              <span v-if="o.expectedPhotos > o.photoCount" class="text-xs text-danger">照片 {{ o.photoCount }}/{{ o.expectedPhotos }}</span>
            </div>
          </div>
          <div class="shrink-0 text-right">
            <div class="font-semibold tabular-nums">{{ fmtMoney(o.amount, o.currency) }}</div>
            <div class="text-xs text-muted">{{ QUOTE_UNITS[o.quoteUnit as keyof typeof QUOTE_UNITS]?.slice(0, 4) }}</div>
          </div>
        </NuxtLink>
      </li>
    </ul>
    <button v-if="items.length < total" class="btn mt-4 w-full" :disabled="loading" @click="more">加载更多（{{ items.length }}/{{ total }}）</button>
  </div>
</template>

<script setup lang="ts">
const q = ref('')
const status = ref('')
const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
let timer: any

async function fetchPage(reset: boolean) {
  loading.value = true; error.value = ''
  try {
    const r = await api<{ items: any[]; total: number }>('/api/observations', {
      query: { q: q.value || undefined, status: status.value || undefined, limit: 30, offset: reset ? 0 : items.value.length, sort: 'recorded_desc' },
    })
    items.value = reset ? r.items : [...items.value, ...r.items]
    total.value = r.total
  } catch (e: any) { error.value = e.network ? '离线中，无法加载服务器记录。' : e.message } finally { loading.value = false }
}
const more = () => fetchPage(false)
watch([q, status], () => { clearTimeout(timer); timer = setTimeout(() => fetchPage(true), 250) })
onMounted(() => fetchPage(true))
</script>
