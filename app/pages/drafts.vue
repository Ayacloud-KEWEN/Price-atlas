<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-1 flex items-center justify-between">
      <h1 class="text-xl font-semibold">草稿与同步</h1>
      <button class="btn btn-sm" :disabled="!sync.online.value || sync.busy.value" @click="syncNow">
        {{ sync.busy.value ? '同步中…' : '立即同步全部' }}
      </button>
    </div>
    <p class="mb-4 text-sm text-muted">
      这里是保存在本机浏览器里的记录。“同步状态”表示是否已送达服务器，“业务状态”表示这条记录的整理进度，两者互不相同。
      应用需处于打开状态才会同步，关闭浏览器后不会在后台同步。
    </p>

    <div v-if="!rows.length" class="card p-8 text-center text-sm text-muted">本机没有草稿。新采集的记录会先出现在这里。</div>

    <ul class="space-y-3">
      <li v-for="r in rows" :key="r.clientId" class="card p-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="truncate font-medium">{{ r.title }}</div>
            <div class="text-xs text-muted">{{ r.subtitle }} · {{ fmtDate(r.createdAt, true) }}</div>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1">
            <span class="badge" :class="syncClass(r.syncState)">同步：{{ SYNC_LABEL[r.syncState] }}</span>
            <span class="badge" :class="statusClass(r.payload.status)">状态：{{ BIZ_STATUS[r.payload.status] }}</span>
          </div>
        </div>

        <p v-if="pi(r.clientId).total" class="mt-2 text-xs" :class="pi(r.clientId).failed ? 'text-danger' : 'text-muted'">
          照片：{{ pi(r.clientId).uploaded }}/{{ pi(r.clientId).total }} 已上传
          <span v-if="pi(r.clientId).failed">，{{ pi(r.clientId).failed }} 张失败</span>
          <span v-if="r.syncState !== 'synced' && pi(r.clientId).total > pi(r.clientId).uploaded">（未上传完整前不会显示为“已同步”）</span>
        </p>
        <p v-if="r.error" class="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-sm text-danger" role="alert">{{ r.error }}</p>

        <div class="mt-3 flex flex-wrap gap-2">
          <button v-if="r.syncState === 'failed' || r.syncState === 'local'" class="btn btn-sm btn-primary" @click="sync.retry(r.clientId)">
            {{ r.syncState === 'failed' ? '重试' : '加入同步' }}
          </button>
          <button v-if="r.syncState === 'pending'" class="btn btn-sm" @click="sync.hold(r.clientId)">暂不同步（仅存本机）</button>
          <NuxtLink v-if="r.syncState !== 'synced' && r.syncState !== 'syncing'" :to="`/capture/edit/${r.clientId}`" class="btn btn-sm">编辑</NuxtLink>
          <NuxtLink v-if="r.syncState === 'synced' && r.serverId" :to="`/quotes/${r.serverId}`" class="btn btn-sm">查看服务器记录</NuxtLink>
          <button class="btn btn-sm btn-danger" @click="del(r)">{{ r.syncState === 'synced' ? '移除本机副本' : '删除' }}</button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { BIZ_STATUS } from '../../shared/templates'
import type { LocalRecord, SyncState } from '../composables/useLocalDb'

const SYNC_LABEL: Record<SyncState, string> = { local: '仅存本机', pending: '待同步', syncing: '同步中', synced: '已同步', failed: '同步失败' }
const syncClass = (s: SyncState) => ({
  local: 'bg-bg text-muted', pending: 'bg-warn-50 text-warn', syncing: 'bg-sky-50 text-sky-800', synced: 'bg-brand-50 text-brand', failed: 'bg-danger-50 text-danger',
}[s])

const sync = useSyncEngine()
const toast = useToast()
const rows = computed(() => sync.records.value)
const photoInfo = ref<Record<string, { total: number; uploaded: number; failed: number }>>({})
const pi = (id: string) => photoInfo.value[id] ?? { total: 0, uploaded: 0, failed: 0 }

async function loadPhotoInfo() {
  const out: typeof photoInfo.value = {}
  for (const r of rows.value) {
    const ps = await localDb.getPhotos(r.clientId).catch(() => [])
    if (ps.length) out[r.clientId] = { total: ps.length, uploaded: ps.filter((p) => p.state === 'uploaded').length, failed: ps.filter((p) => p.state === 'failed').length }
  }
  photoInfo.value = out
}
onMounted(async () => { await sync.refresh(); await loadPhotoInfo() })
watch(rows, loadPhotoInfo)

async function syncNow() { await sync.syncAll(); await loadPhotoInfo() }
async function del(r: LocalRecord) {
  const msg = r.syncState === 'synced'
    ? '移除本机副本？服务器上的记录不受影响。'
    : '这条记录还没有同步到服务器，删除后将无法恢复。确定删除吗？'
  if (!confirm(msg)) return
  await sync.remove(r.clientId)
  toast.info('已删除')
}
</script>
