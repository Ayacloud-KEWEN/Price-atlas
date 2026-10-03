<template>
  <section class="card p-4">
    <h2 class="section-title mb-1">商家、门店与渠道</h2>
    <p class="mb-3 text-xs text-muted">销售国家/城市是“销售市场”；选择门店后录入时会自动带入市场与默认币种，仍可修改。</p>
    <form class="mb-4 grid gap-2 sm:grid-cols-4" @submit.prevent="submit">
      <input v-model="f.name" class="input" placeholder="商家名称 *" aria-label="商家名称" />
      <input v-model="f.storeName" class="input" placeholder="具体门店（可选）" aria-label="具体门店" />
      <select v-model="f.channelType" class="input" aria-label="渠道类型"><option v-for="(l, k) in CHANNEL_TYPES" :key="k" :value="k">{{ l }}</option></select>
      <input v-model="f.url" class="input" placeholder="网址（可选）" aria-label="网址" />
      <input v-model="f.country" class="input" placeholder="销售国家" aria-label="销售国家" />
      <input v-model="f.city" class="input" placeholder="城市" aria-label="城市" />
      <input v-model="f.defaultCurrency" class="input uppercase" maxlength="3" placeholder="默认币种 EUR" aria-label="默认币种" />
      <div class="flex gap-2"><button class="btn btn-primary flex-1" :disabled="!f.name.trim() || busy">{{ editId ? '保存修改' : '添加' }}</button>
        <button v-if="editId" type="button" class="btn" @click="reset">取消</button></div>
    </form>
    <p v-if="err" class="err mb-2">{{ err }}</p>
    <div class="overflow-x-auto">
      <table class="tbl min-w-[720px]">
        <thead><tr><th>商家 · 门店</th><th>渠道</th><th>国家 · 城市</th><th>默认币种</th><th>网址</th><th></th></tr></thead>
        <tbody>
          <tr v-for="m in meta.merchants" :key="m.id">
            <td class="font-medium">{{ m.name }}<span v-if="m.storeName" class="font-normal text-muted"> · {{ m.storeName }}</span></td>
            <td>{{ CHANNEL_TYPES[m.channelType] }}</td><td>{{ [m.country, m.city].filter(Boolean).join(' · ') || '—' }}</td>
            <td>{{ m.defaultCurrency || '—' }}</td><td class="max-w-[14rem] truncate text-xs">{{ m.url }}</td>
            <td class="whitespace-nowrap"><button class="btn btn-sm" @click="start(m)">编辑</button> <button class="btn btn-sm btn-danger" @click="del(m.id)">删除</button></td>
          </tr>
          <tr v-if="!meta.merchants.length"><td colspan="6" class="py-8 text-center text-muted">还没有商家。</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { CHANNEL_TYPES } from '../../../shared/templates'

const { meta, load } = useMeta()
const toast = useToast()
const blank = () => ({ name: '', storeName: '', channelType: 'other', url: '', country: '', city: '', defaultCurrency: '' })
const f = reactive(blank())
const editId = ref('')
const busy = ref(false)
const err = ref('')
const reset = () => { Object.assign(f, blank()); editId.value = '' }
const start = (m: any) => { editId.value = m.id; Object.assign(f, { name: m.name, storeName: m.storeName ?? '', channelType: m.channelType, url: m.url ?? '', country: m.country ?? '', city: m.city ?? '', defaultCurrency: m.defaultCurrency ?? '' }) }
async function run(fn: () => Promise<unknown>, ok: string) {
  busy.value = true; err.value = ''
  try { await fn(); toast.success(ok); await load(true) } catch (x: any) { err.value = Object.values(x.fields ?? {}).join('；') || x.message } finally { busy.value = false }
}
const submit = () => run(async () => {
  if (editId.value) await api(`/api/merchants/${editId.value}`, { method: 'PATCH', body: { ...f } })
  else await api('/api/merchants', { method: 'POST', body: { ...f } })
  reset()
}, '已保存')
const del = (id: string) => { if (confirm('删除该商家？')) run(() => api(`/api/merchants/${id}`, { method: 'DELETE' }), '已删除') }
</script>
