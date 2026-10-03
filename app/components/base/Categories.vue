<template>
  <div class="grid gap-6 lg:grid-cols-2">
    <section class="card p-4" aria-labelledby="cat-h">
      <h2 id="cat-h" class="section-title mb-3">分类树</h2>
      <ul class="space-y-1">
        <li v-for="c in tree" :key="c.id" :style="{ paddingLeft: c.depth * 20 + 'px' }">
          <div class="flex items-center gap-2 rounded-lg px-2 py-1" :class="sel === c.id ? 'bg-brand-50' : ''">
            <button class="min-w-0 flex-1 truncate text-left text-sm" :class="c.archived ? 'text-muted line-through' : ''" @click="select(c.id)">
              {{ c.name }} <span v-if="c.template" class="chip ml-1">{{ TEMPLATES[c.template]?.label ?? c.template }}</span>
              <span v-if="c.systemKey" class="chip ml-1">系统</span>
            </button>
          </div>
        </li>
      </ul>
      <form class="mt-4 space-y-2 border-t border-line pt-4" @submit.prevent="add">
        <p class="text-sm font-medium">新增分类{{ sel ? '（作为所选分类的子分类）' : '（顶级）' }}</p>
        <div class="flex flex-wrap gap-2">
          <input v-model="newName" class="input !w-48" placeholder="分类名称" aria-label="新分类名称" />
          <select v-model="newTemplate" class="input !w-44" aria-label="专属表单模板">
            <option value="">继承 / 通用</option>
            <option v-for="t in TEMPLATE_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}模板</option>
          </select>
          <button class="btn btn-primary" :disabled="!newName.trim() || busy">添加</button>
          <button v-if="sel" type="button" class="btn" @click="sel = ''">改为顶级</button>
        </div>
        <p v-if="err" class="err">{{ err }}</p>
      </form>
    </section>

    <section class="card p-4" aria-labelledby="sel-h">
      <template v-if="cur">
        <h2 id="sel-h" class="section-title mb-3">{{ cur.path.join(' › ') }}</h2>
        <div class="grid gap-3 sm:grid-cols-2">
          <div><label class="label" for="c-name">名称</label><input id="c-name" v-model="edit.name" class="input" /></div>
          <div><label class="label" for="c-tpl">专属表单模板</label>
            <select id="c-tpl" v-model="edit.template" class="input"><option value="">继承上级 / 通用</option>
              <option v-for="t in TEMPLATE_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option></select></div>
          <div><label class="label" for="c-parent">上级分类</label>
            <select id="c-parent" v-model="edit.parentId" class="input"><option value="">（顶级）</option>
              <option v-for="c in tree.filter((x) => x.id !== cur!.id)" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.name }}</option></select>
            <p class="hint">事后调整分类不会改变历史价格记录。</p></div>
          <label class="flex items-center gap-2 pt-7 text-sm"><input v-model="edit.archived" type="checkbox" class="h-4 w-4 accent-brand" /> 归档（不再出现在选择列表）</label>
        </div>
        <div class="mt-3 flex gap-2">
          <button class="btn btn-primary btn-sm" :disabled="busy" @click="saveCat">保存</button>
          <button v-if="!cur.systemKey" class="btn btn-danger btn-sm" :disabled="busy" @click="delCat">删除</button>
        </div>
        <p v-if="err" class="err">{{ err }}</p>

        <h3 class="section-title mb-2 mt-6">自定义属性（表单字段）</h3>
        <p class="hint mb-2">在此为该品类（及其子分类）新增字段，录入新商品时会自动出现，无需改代码。</p>
        <p v-if="!defs.length" class="rounded-lg border border-dashed border-line p-4 text-center text-sm text-muted">还没有自定义属性。</p>
        <ul class="space-y-1 text-sm">
          <li v-for="d in defs" :key="d.id" class="flex items-center justify-between rounded-lg border border-line px-3 py-2">
            <span>{{ d.label }} <span class="chip">{{ TYPE_LABEL[d.type] }}</span><span v-if="d.unit" class="chip">{{ d.unit }}</span>
              <span v-if="d.options?.length" class="text-xs text-muted"> {{ d.options.join(' / ') }}</span></span>
            <button class="btn btn-sm btn-danger" @click="delDef(d.id)">删除</button>
          </li>
        </ul>
        <form class="mt-3 space-y-2 rounded-lg bg-bg p-3" @submit.prevent="addDef">
          <div class="grid gap-2 sm:grid-cols-2">
            <input v-model="def.label" class="input" placeholder="属性名，如 烘焙度" aria-label="属性名" />
            <select v-model="def.type" class="input" aria-label="类型"><option v-for="(l, k) in TYPE_LABEL" :key="k" :value="k">{{ l }}</option></select>
            <input v-if="def.type === 'measure' || def.type === 'number'" v-model="def.unit" class="input" placeholder="单位（带单位的数值必填）" aria-label="单位" />
            <input v-if="def.type === 'enum'" v-model="def.options" class="input sm:col-span-2" placeholder="选项，用逗号分隔：浅度, 中度, 深度" aria-label="选项" />
          </div>
          <p v-if="defErr" class="err">{{ defErr }}</p>
          <button class="btn btn-sm btn-primary" :disabled="!def.label.trim() || busy">添加属性</button>
        </form>
      </template>
      <p v-else id="sel-h" class="py-10 text-center text-sm text-muted">在左侧选择一个分类，编辑它或管理它的自定义属性。</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { TEMPLATES, TEMPLATE_OPTIONS } from '../../../shared/templates'

const TYPE_LABEL: Record<string, string> = { text: '文本', number: '数字', enum: '枚举', measure: '带单位数值' }
const { meta, load } = useMeta()
const toast = useToast()
const sel = ref('')
const busy = ref(false)
const err = ref('')
const defErr = ref('')
const newName = ref('')
const newTemplate = ref('')
const edit = reactive({ name: '', template: '', parentId: '', archived: false })
const def = reactive({ label: '', type: 'text', unit: '', options: '' })

const tree = computed(() => {
  const out: any[] = []
  const walk = (parent: string | null, depth: number) => {
    for (const c of meta.value.categories.filter((x) => x.parentId === parent).sort((a, b) => a.sortOrder - b.sortOrder)) {
      out.push({ ...c, depth }); walk(c.id, depth + 1)
    }
  }
  walk(null, 0)
  return out
})
const cur = computed(() => meta.value.categories.find((c) => c.id === sel.value))
const defs = computed(() => meta.value.attributeDefs.filter((d) => d.categoryId === sel.value))
function select(id: string) {
  sel.value = id; err.value = ''
  const c = meta.value.categories.find((x) => x.id === id)!
  Object.assign(edit, { name: c.name, template: c.template ?? '', parentId: c.parentId ?? '', archived: c.archived })
}

async function run(fn: () => Promise<unknown>, ok: string, target = err) {
  busy.value = true; target.value = ''
  try { await fn(); toast.success(ok); await load(true) } catch (e: any) { target.value = Object.values(e.fields ?? {}).join('；') || e.message } finally { busy.value = false }
}
const add = () => run(async () => {
  await api('/api/categories', { method: 'POST', body: { name: newName.value.trim(), parentId: sel.value || null, template: newTemplate.value || null } })
  newName.value = ''; newTemplate.value = ''
}, '分类已添加')
const saveCat = () => run(() => api(`/api/categories/${sel.value}`, { method: 'PATCH', body: { name: edit.name.trim(), template: edit.template || null, parentId: edit.parentId || null, archived: edit.archived } }), '已保存')
const delCat = () => { if (confirm('确定删除这个分类？')) run(async () => { await api(`/api/categories/${sel.value}`, { method: 'DELETE' }); sel.value = '' }, '已删除') }
const addDef = () => run(async () => {
  await api('/api/attribute-defs', { method: 'POST', body: {
    categoryId: sel.value, label: def.label.trim(), type: def.type, unit: def.unit || null,
    options: def.type === 'enum' ? def.options.split(/[,，]/).map((s) => s.trim()).filter(Boolean) : null,
  } })
  Object.assign(def, { label: '', unit: '', options: '' })
}, '属性已添加', defErr)
const delDef = (id: string) => { if (confirm('删除属性定义？已保存在商品里的值不会被删除。')) run(() => api(`/api/attribute-defs/${id}`, { method: 'DELETE' }), '已删除') }
</script>
