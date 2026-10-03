<template>
  <div>
    <h1 class="mb-1 text-xl font-semibold">待整理收件箱</h1>
    <p class="mb-4 text-sm text-muted">来自手机的草稿与待核查记录（所有品类）。点击进入核查页：并排查看照片与字段、匹配商品、补充报价条件。</p>

    <div class="mb-3 flex flex-wrap items-center gap-2">
      <div role="tablist" class="flex rounded-lg border border-line bg-surface p-0.5 text-sm">
        <button v-for="t in tabs" :key="t.key" role="tab" :aria-selected="tab === t.key" class="rounded-md px-3 py-1.5"
          :class="tab === t.key ? 'bg-brand text-white' : 'text-ink'" @click="tab = t.key">{{ t.label }}</button>
      </div>
      <input v-model="q" type="search" class="input !w-56" placeholder="搜索名称 / 备注" aria-label="搜索" />
      <label class="flex items-center gap-1.5 text-sm"><input v-model="onlyUnlinked" type="checkbox" class="h-4 w-4 accent-brand" /> 仅未关联商品</label>
      <span class="ml-auto text-sm text-muted">共 {{ total }} 条</span>
    </div>

    <!-- 批量操作 -->
    <div v-if="selected.size" class="card sticky top-2 z-10 mb-3 flex flex-wrap items-center gap-2 p-3">
      <span class="text-sm font-medium">已选 {{ selected.size }} 条</span>
      <select v-model="bulkCat" class="input !w-52" aria-label="批量设置分类">
        <option value="">批量改分类…</option>
        <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.label }}</option>
      </select>
      <button class="btn btn-sm" :disabled="!bulkCat || busy" @click="bulk({ action: 'setCategory', categoryId: bulkCat })">应用分类</button>
      <input v-model="bulkTag" class="input !w-36" placeholder="标签" list="bulk-tags" aria-label="批量添加标签" />
      <datalist id="bulk-tags"><option v-for="t in meta.tags" :key="t.id" :value="t.name" /></datalist>
      <button class="btn btn-sm" :disabled="!bulkTag.trim() || busy" @click="bulk({ action: 'addTag', tag: bulkTag.trim() })">添加标签</button>
      <button class="btn btn-sm" :disabled="busy" @click="bulk({ action: 'setStatus', status: 'pending' })">标记待核查</button>
      <button class="btn btn-sm" :disabled="busy" @click="selected = new Set()">取消选择</button>
    </div>
    <div v-if="bulkResult" class="mb-3 rounded-lg border border-brand/40 bg-brand-50 p-3 text-sm" role="status">
      <b>批量操作完成：</b>成功更新 {{ bulkResult.updated }} 条<span v-if="bulkResult.productsUpdated">，其中同步修改了 {{ bulkResult.productsUpdated }} 个已关联商品的分类（历史价格记录保留各自的分类快照）</span>。
      <ul v-if="bulkResult.skipped.length" class="mt-1 list-disc pl-5 text-danger">
        <li v-for="s in bulkResult.skipped" :key="s.id">已跳过 {{ nameOf(s.id) }}：{{ s.reason }}</li>
      </ul>
    </div>

    <p v-if="error" class="text-danger">{{ error }}</p>
    <div class="card overflow-x-auto">
      <table class="tbl min-w-[860px]">
        <thead><tr>
          <th class="w-8"><input type="checkbox" class="h-4 w-4 accent-brand" :checked="allChecked" aria-label="全选" @change="toggleAll" /></th>
          <th>照片</th><th>现场记录</th><th>分类</th><th>来源</th><th class="num">金额</th><th>状态</th><th>关联</th><th>录入时间</th>
        </tr></thead>
        <tbody>
          <tr v-for="o in items" :key="o.id">
            <td><input type="checkbox" class="h-4 w-4 accent-brand" :checked="selected.has(o.id)" :aria-label="`选择 ${o.displayName || '未命名'}`" @change="toggle(o.id)" /></td>
            <td>
              <img v-if="o.firstPhotoId" :src="`/api/attachments/${o.firstPhotoId}/file`" alt="" class="h-12 w-12 rounded object-cover" loading="lazy" />
              <span v-else class="text-xs text-muted">无</span>
              <div v-if="o.expectedPhotos > o.photoCount" class="text-[11px] text-danger">照片 {{ o.photoCount }}/{{ o.expectedPhotos }}</div>
            </td>
            <td class="max-w-[18rem]">
              <NuxtLink :to="`/quotes/${o.id}`" class="font-medium text-brand hover:underline">{{ o.displayName || '未命名' }}</NuxtLink>
              <div class="truncate text-xs text-muted">{{ o.rawSpec || o.notes }}</div>
              <span v-for="t in o.tags" :key="t" class="chip mr-1">{{ t }}</span>
            </td>
            <td class="text-xs">{{ o.categoryPath.join(' › ') || '—' }}</td>
            <td class="text-xs">{{ o.merchantName || '—' }}<div class="text-muted">{{ fmtDate(o.observedAt) }}</div></td>
            <td class="num whitespace-nowrap">{{ o.amount ? fmtMoney(o.amount, o.currency) : '未填价格' }}</td>
            <td><StatusBadge :status="o.status" /></td>
            <td class="text-xs">{{ o.variantId ? '已关联' : '未关联' }}</td>
            <td class="whitespace-nowrap text-xs text-muted">{{ fmtDate(o.recordedAt, true) }}</td>
          </tr>
          <tr v-if="!loading && !items.length"><td colspan="9" class="py-12 text-center text-muted">收件箱是空的。手机端同步过来的草稿和待核查记录会出现在这里。</td></tr>
        </tbody>
      </table>
    </div>
    <button v-if="items.length < total" class="btn mt-3 w-full" :disabled="loading" @click="more">加载更多（{{ items.length }}/{{ total }}）</button>
  </div>
</template>

<script setup lang="ts">
const { meta, load, categoryOptions } = useMeta()
const toast = useToast()
const tabs = [{ key: 'draft,pending', label: '全部待处理' }, { key: 'draft', label: '草稿' }, { key: 'pending', label: '待核查' }]
const tab = ref('draft,pending')
const q = ref('')
const onlyUnlinked = ref(false)
const items = ref<any[]>([])
const total = ref(0)
const loading = ref(false)
const error = ref('')
const selected = ref(new Set<string>())
const bulkCat = ref('')
const bulkTag = ref('')
const busy = ref(false)
const bulkResult = ref<any>(null)
let timer: any

const allChecked = computed(() => items.value.length > 0 && items.value.every((o) => selected.value.has(o.id)))
function toggle(id: string) { const s = new Set(selected.value); s.has(id) ? s.delete(id) : s.add(id); selected.value = s }
function toggleAll() { selected.value = allChecked.value ? new Set() : new Set(items.value.map((o) => o.id)) }
const nameOf = (id: string) => items.value.find((o) => o.id === id)?.displayName || id.slice(0, 8)

async function fetchPage(reset: boolean) {
  loading.value = true; error.value = ''
  try {
    const r = await api<{ items: any[]; total: number }>('/api/observations', {
      query: { status: tab.value, q: q.value || undefined, unlinked: onlyUnlinked.value ? '1' : undefined, limit: 50, offset: reset ? 0 : items.value.length, sort: 'recorded_desc' },
    })
    items.value = reset ? r.items : [...items.value, ...r.items]; total.value = r.total
  } catch (e: any) { error.value = e.message } finally { loading.value = false }
}
const more = () => fetchPage(false)
watch([tab, onlyUnlinked, q], () => { clearTimeout(timer); timer = setTimeout(() => { selected.value = new Set(); fetchPage(true) }, 200) })
onMounted(async () => { await load().catch(() => {}); await fetchPage(true) })

async function bulk(action: Record<string, any>) {
  busy.value = true; bulkResult.value = null
  try {
    const r = await api('/api/observations/bulk', { method: 'POST', body: { ...action, ids: [...selected.value] } })
    bulkResult.value = r
    toast.success(`已更新 ${r.updated} 条${r.skipped.length ? `，跳过 ${r.skipped.length} 条` : ''}`)
    bulkCat.value = ''; bulkTag.value = ''
    await load(true).catch(() => {})
    await fetchPage(true)
    selected.value = new Set()
  } catch (e: any) { toast.error(`批量操作失败：${e.message}`) } finally { busy.value = false }
}
</script>
