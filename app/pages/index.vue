<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="mb-1 text-xl font-semibold">采集</h1>
    <p class="mb-5 text-sm text-muted">任何商品都能先记录，常用品类有专属字段，资料不完整可以稍后整理。</p>
    <div class="grid gap-3 sm:grid-cols-3">
      <NuxtLink to="/capture/price" class="card block p-5 hover:bg-brand-50">
        <div class="text-2xl" aria-hidden="true">🔁</div>
        <div class="mt-2 font-semibold">记录已有商品的新价格</div>
        <p class="mt-1 text-sm text-muted">搜索最近商品、名称或条码，选择规格，录入本次价格。</p>
      </NuxtLink>
      <NuxtLink to="/capture/new" class="card block p-5 hover:bg-brand-50">
        <div class="text-2xl" aria-hidden="true">＋</div>
        <div class="mt-2 font-semibold">新商品</div>
        <p class="mt-1 text-sm text-muted">选择品类，填写通用字段，按需展开专属字段。</p>
      </NuxtLink>
      <NuxtLink to="/capture/quick" class="card block p-5 hover:bg-brand-50">
        <div class="text-2xl" aria-hidden="true">📷</div>
        <div class="mt-2 font-semibold">先拍下来</div>
        <p class="mt-1 text-sm text-muted">拍摄产品、价签或背标，写句备注，稍后整理。</p>
      </NuxtLink>
    </div>

    <section class="mt-8" aria-labelledby="recent">
      <h2 id="recent" class="section-title mb-2">最近记录</h2>
      <div v-if="sync.unsyncedCount.value" class="mb-3 rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn">
        本机有 {{ sync.unsyncedCount.value }} 条尚未同步完成的记录，
        <NuxtLink to="/drafts" class="font-semibold underline">查看草稿</NuxtLink>
      </div>
      <p v-if="loading" class="text-sm text-muted">加载中…</p>
      <p v-else-if="error" class="text-sm text-danger">{{ error }}</p>
      <div v-else-if="!items.length" class="card p-6 text-center text-sm text-muted">还没有任何记录。从上面的三个入口开始吧。</div>
      <ul v-else class="space-y-2">
        <li v-for="o in items" :key="o.id">
          <NuxtLink :to="`/quotes/${o.id}`" class="card flex items-center justify-between gap-3 p-3 hover:bg-brand-50">
            <div class="min-w-0">
              <div class="truncate font-medium">{{ o.displayName || '未命名' }}</div>
              <div class="truncate text-xs text-muted">{{ o.merchantName || '未填来源' }} · {{ fmtDate(o.observedAt) }}</div>
            </div>
            <div class="shrink-0 text-right">
              <div class="font-semibold tabular-nums">{{ fmtMoney(o.amount, o.currency) }}</div>
              <StatusBadge :status="o.status" />
            </div>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<script setup lang="ts">
const sync = useSyncEngine()
const items = ref<any[]>([])
const loading = ref(true)
const error = ref('')
onMounted(async () => {
  try {
    const r = await api<{ items: any[] }>('/api/observations', { query: { limit: 6, sort: 'recorded_desc' } })
    items.value = r.items
  } catch (e: any) { error.value = e.network ? '离线中，无法加载服务器上的最近记录。' : e.message } finally { loading.value = false }
})
</script>
