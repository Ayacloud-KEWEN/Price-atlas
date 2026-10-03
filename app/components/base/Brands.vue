<template>
  <section class="card p-4">
    <h2 class="section-title mb-1">品牌</h2>
    <p class="mb-3 text-xs text-muted">“所在地”是品牌所在国家，与生产/养殖产地、销售市场是不同概念。</p>
    <form class="mb-4 grid gap-2 sm:grid-cols-5" @submit.prevent="add">
      <input v-model="n.name" class="input" placeholder="品牌名" aria-label="品牌名" />
      <input v-model="n.nameOriginal" class="input" placeholder="原文名" aria-label="原文名" />
      <input v-model="n.country" class="input" placeholder="品牌所在地" aria-label="品牌所在地" />
      <input v-model="n.notes" class="input" placeholder="备注" aria-label="备注" />
      <button class="btn btn-primary" :disabled="!n.name.trim() || busy">添加</button>
    </form>
    <p v-if="err" class="err mb-2">{{ err }}</p>
    <div class="overflow-x-auto">
      <table class="tbl min-w-[600px]">
        <thead><tr><th>品牌</th><th>原文名</th><th>所在地</th><th>备注</th><th></th></tr></thead>
        <tbody>
          <tr v-for="b in meta.brands" :key="b.id">
            <template v-if="editId === b.id">
              <td><input v-model="e.name" class="input" aria-label="品牌" /></td><td><input v-model="e.nameOriginal" class="input" aria-label="原文名" /></td>
              <td><input v-model="e.country" class="input" aria-label="所在地" /></td><td><input v-model="e.notes" class="input" aria-label="备注" /></td>
              <td class="whitespace-nowrap"><button class="btn btn-sm btn-primary" @click="save(b.id)">保存</button> <button class="btn btn-sm" @click="editId = ''">取消</button></td>
            </template>
            <template v-else>
              <td class="font-medium">{{ b.name }}</td><td>{{ b.nameOriginal || '—' }}</td><td>{{ b.country || '—' }}</td><td class="text-xs">{{ b.notes }}</td>
              <td class="whitespace-nowrap"><button class="btn btn-sm" @click="start(b)">编辑</button> <button class="btn btn-sm btn-danger" @click="del(b.id)">删除</button></td>
            </template>
          </tr>
          <tr v-if="!meta.brands.length"><td colspan="5" class="py-8 text-center text-muted">还没有品牌。录入新商品时会自动创建，也可在这里手动添加。</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
const { meta, load } = useMeta()
const toast = useToast()
const n = reactive({ name: '', nameOriginal: '', country: '', notes: '' })
const e = reactive({ name: '', nameOriginal: '', country: '', notes: '' })
const editId = ref('')
const busy = ref(false)
const err = ref('')
async function run(fn: () => Promise<unknown>, ok: string) {
  busy.value = true; err.value = ''
  try { await fn(); toast.success(ok); await load(true) } catch (x: any) { err.value = Object.values(x.fields ?? {}).join('；') || x.message } finally { busy.value = false }
}
const add = () => run(async () => { await api('/api/brands', { method: 'POST', body: { ...n } }); Object.assign(n, { name: '', nameOriginal: '', country: '', notes: '' }) }, '已添加')
const start = (b: any) => { editId.value = b.id; Object.assign(e, { name: b.name, nameOriginal: b.nameOriginal ?? '', country: b.country ?? '', notes: b.notes ?? '' }) }
const save = (id: string) => run(async () => { await api(`/api/brands/${id}`, { method: 'PATCH', body: { ...e } }); editId.value = '' }, '已保存')
const del = (id: string) => { if (confirm('删除该品牌？')) run(() => api(`/api/brands/${id}`, { method: 'DELETE' }), '已删除') }
</script>
