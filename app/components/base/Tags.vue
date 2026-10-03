<template>
  <section class="card p-4">
    <h2 class="section-title mb-1">标签</h2>
    <p class="mb-3 text-xs text-muted">分类负责结构，标签负责灵活标记，例如“礼品”“想买”“展会发现”“竞品”。</p>
    <form class="mb-4 flex gap-2" @submit.prevent="add">
      <input v-model="name" class="input !w-64" placeholder="新标签" aria-label="新标签" />
      <button class="btn btn-primary" :disabled="!name.trim() || busy">添加</button>
    </form>
    <p v-if="err" class="err mb-2">{{ err }}</p>
    <p v-if="!meta.tags.length" class="py-8 text-center text-sm text-muted">还没有标签。</p>
    <ul class="flex flex-wrap gap-2">
      <li v-for="t in meta.tags" :key="t.id" class="flex items-center gap-1 rounded-full border border-line bg-white py-1 pl-3 pr-1 text-sm">
        <template v-if="editId === t.id">
          <input v-model="editName" class="input !min-h-8 !w-32 !py-0.5" aria-label="标签名" @keyup.enter="save(t.id)" />
          <button class="btn btn-sm" @click="save(t.id)">存</button>
        </template>
        <template v-else>
          {{ t.name }}
          <button class="btn btn-sm !min-h-8 border-0" :aria-label="`重命名 ${t.name}`" @click="editId = t.id; editName = t.name">改</button>
          <button class="btn btn-sm btn-danger !min-h-8 border-0" :aria-label="`删除 ${t.name}`" @click="del(t.id, t.name)">×</button>
        </template>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
const { meta, load } = useMeta()
const toast = useToast()
const name = ref('')
const editId = ref('')
const editName = ref('')
const busy = ref(false)
const err = ref('')
async function run(fn: () => Promise<unknown>, ok: string) {
  busy.value = true; err.value = ''
  try { await fn(); toast.success(ok); await load(true) } catch (x: any) { err.value = Object.values(x.fields ?? {}).join('；') || x.message } finally { busy.value = false }
}
const add = () => run(async () => { await api('/api/tags', { method: 'POST', body: { name: name.value.trim() } }); name.value = '' }, '已添加')
const save = (id: string) => run(async () => { await api(`/api/tags/${id}`, { method: 'PATCH', body: { name: editName.value.trim() } }); editId.value = '' }, '已保存')
const del = (id: string, n: string) => { if (confirm(`删除标签“${n}”？商品上的该标签也会移除。`)) run(() => api(`/api/tags/${id}`, { method: 'DELETE' }), '已删除') }
</script>
