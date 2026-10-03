<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <div v-if="!lockedProduct">
      <label class="label" :for="`${uidp}-cat`">品类<span class="text-danger"> *</span></label>
      <select :id="`${uidp}-cat`" v-model="f.categoryId" class="input" :class="{ 'input-error': errors['product.categoryId'] }" @change="onCat">
        <option value="" disabled>选择品类…</option>
        <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.label }}</option>
      </select>
      <p v-if="errors['product.categoryId']" class="err">{{ errors['product.categoryId'] }}</p>
      <p v-if="orphan" class="mt-2 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn" role="status">{{ orphan }}</p>
    </div>
    <div v-if="!lockedProduct" class="grid gap-4 sm:grid-cols-2">
      <div>
        <label class="label" :for="`${uidp}-brand`">品牌（可未知）</label>
        <input :id="`${uidp}-brand`" v-model="f.brand" class="input" :list="`${uidp}-brands`" autocomplete="off" />
        <datalist :id="`${uidp}-brands`"><option v-for="b in meta.brands" :key="b.id" :value="b.name" /></datalist>
      </div>
      <div>
        <label class="label" :for="`${uidp}-name`">商品名称<span class="text-danger"> *</span></label>
        <input :id="`${uidp}-name`" v-model="f.name" class="input" :class="{ 'input-error': errors['product.name'] }" />
        <p v-if="errors['product.name']" class="err">{{ errors['product.name'] }}</p>
      </div>
      <div><label class="label" :for="`${uidp}-orig`">原文名称</label><input :id="`${uidp}-orig`" v-model="f.nameOriginal" class="input" /></div>
      <div><label class="label" :for="`${uidp}-series`">型号 / 系列</label><input :id="`${uidp}-series`" v-model="f.series" class="input" /></div>
    </div>

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <div class="col-span-1">
        <label class="label" :for="`${uidp}-size`">{{ tpl.labels.unitSize }}</label>
        <input :id="`${uidp}-size`" v-model="f.unitSize" class="input text-right" inputmode="decimal" placeholder="不适用留空" :class="{ 'input-error': errors['variant.unitSize'] || errors['variant.unitSizeUnit'] }" />
      </div>
      <div>
        <label class="label" :for="`${uidp}-unit`">单位</label>
        <select :id="`${uidp}-unit`" v-model="f.unitSizeUnit" class="input"><option v-for="(u, k) in MEASURE_UNITS" :key="k" :value="k">{{ u.label }}</option></select>
      </div>
      <div>
        <label class="label" :for="`${uidp}-pack`">{{ tpl.labels.packCount }}</label>
        <input :id="`${uidp}-pack`" v-model="f.packCount" class="input text-right" inputmode="numeric" />
      </div>
      <div>
        <label class="label" :for="`${uidp}-ed`">{{ tpl.labels.edition }}</label>
        <input :id="`${uidp}-ed`" v-model="f.edition" class="input" :list="`${uidp}-eds`" />
        <datalist :id="`${uidp}-eds`"><option v-for="s in tpl.editionSuggestions" :key="s" :value="s" /></datalist>
      </div>
      <div class="col-span-2"><label class="label" :for="`${uidp}-bc`">条码</label><input :id="`${uidp}-bc`" v-model="f.barcode" class="input" inputmode="numeric" /></div>
      <div class="col-span-2"><label class="label" :for="`${uidp}-pd`">包装说明</label><input :id="`${uidp}-pd`" v-model="f.packDescription" class="input" /></div>
    </div>
    <p v-if="errors['variant.unitSize'] || errors['variant.unitSizeUnit']" class="err">{{ errors['variant.unitSize'] || errors['variant.unitSizeUnit'] }}</p>
    <label class="flex min-h-9 items-center gap-2 text-sm">
      <input v-model="f.isMixedSet" type="checkbox" class="h-4 w-4 accent-brand" /> 混合礼盒 / 成分不同的套装（只保留整套价格）
    </label>

    <div v-if="fields.length" class="rounded-lg border border-line p-3">
      <p class="section-title mb-3">{{ tpl.label }}专属信息</p>
      <AttrFields :fields="fields" :model="f.attrs" @change="(k: string, v: unknown) => (f.attrs[k] = v)" />
    </div>

    <div v-if="!lockedProduct">
      <label class="label" :for="`${uidp}-tags`">标签（逗号分隔）</label>
      <input :id="`${uidp}-tags`" v-model="tagsText" class="input" />
    </div>

    <p v-if="errorMsg" class="err" role="alert">{{ errorMsg }}</p>
    <div class="flex gap-2">
      <button class="btn btn-primary" :disabled="busy">{{ busy ? '保存中…' : submitLabel }}</button>
      <button v-if="cancellable" type="button" class="btn" @click="$emit('cancel')">取消</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { getTemplate, TEMPLATES } from '../../shared/templates'
import { MEASURE_UNITS } from '../../shared/pricing'

const props = withDefaults(defineProps<{
  /** 已有商品（仅新增规格） */
  lockedProduct?: { id: string; categoryId: string } | null
  initial?: Partial<{ categoryId: string; name: string; brand: string; unitSize: string; unitSizeUnit: string; packCount: string; barcode: string }>
  submitLabel?: string
  cancellable?: boolean
  busy?: boolean
  errorMsg?: string
  errors?: Record<string, string>
}>(), { submitLabel: '保存', cancellable: false, busy: false, errors: () => ({}) })
const emit = defineEmits<{ submit: [payload: { product?: any; variant: any }]; cancel: [] }>()

const uidp = `pqf-${Math.random().toString(36).slice(2, 7)}`
const { meta, load, categoryOptions, fieldsFor, categoryById } = useMeta()
const f = reactive({
  categoryId: props.lockedProduct?.categoryId ?? props.initial?.categoryId ?? '',
  brand: props.initial?.brand ?? '', name: props.initial?.name ?? '', nameOriginal: '', series: '',
  barcode: props.initial?.barcode ?? '', unitSize: props.initial?.unitSize ?? '', unitSizeUnit: props.initial?.unitSizeUnit ?? 'ml',
  packCount: props.initial?.packCount ?? '', packDescription: '', edition: '', isMixedSet: false,
  attrs: {} as Record<string, any>,
})
const tagsText = ref('')
const orphan = ref('')
const errors = computed(() => props.errors)
onMounted(() => load().catch(() => {}))

const tpl = computed(() => getTemplate(categoryById(f.categoryId)?.effectiveTemplate))
const fields = computed(() => fieldsFor(f.categoryId))
const knownLabels = new Map(Object.values(TEMPLATES).flatMap((t) => t.fields).map((x) => [x.key, x.label]))
const customLeft = ref<{ name: string; value: string }[]>([])

function onCat() {
  if (!f.unitSize && tpl.value.defaultUnit) f.unitSizeUnit = tpl.value.defaultUnit
  const keys = new Set(fields.value.map((x) => x.key))
  let moved = 0
  for (const [k, v] of Object.entries(f.attrs)) {
    if (v === '' || v == null || v === false || keys.has(k)) continue
    customLeft.value.push({ name: knownLabels.get(k) ?? k, value: String(v) }); delete f.attrs[k]; moved++
  }
  orphan.value = moved ? `已填写的 ${moved} 项信息不适用于新品类，将保留为自定义属性，不会丢失。` : ''
}

const num = (s: string) => { const t = s.trim().replace(',', '.'); return /^\d+(\.\d+)?$/.test(t) ? t : null }
const int = (s: string) => { const n = Number(s.trim()); return s.trim() && Number.isInteger(n) && n >= 0 ? n : null }
const nz = (s: any) => (s === '' || s == null ? null : s)

function submit() {
  const product: Record<string, any> = {}; const variant: Record<string, any> = {}
  for (const d of fields.value) {
    let v = f.attrs[d.key]
    if (v === '' || v == null || (d.type === 'bool' && !v)) continue
    if (d.type === 'number' || d.type === 'year') { const n = Number(String(v).replace(',', '.')); if (!Number.isNaN(n)) v = n }
    ;(d.level === 'variant' ? variant : product)[d.key] = v
  }
  const brandName = f.brand.trim()
  const brand = brandName ? meta.value.brands.find((b: any) => b.name.toLowerCase() === brandName.toLowerCase()) : null
  const variantPart = {
    barcode: nz(f.barcode), unitSize: f.unitSize ? num(f.unitSize) : null, unitSizeUnit: f.unitSize ? f.unitSizeUnit : null,
    packCount: int(f.packCount), packDescription: nz(f.packDescription), edition: nz(f.edition), isMixedSet: f.isMixedSet, attrs: variant,
  }
  if (props.lockedProduct) { emit('submit', { variant: variantPart }); return }
  emit('submit', {
    product: {
      categoryId: f.categoryId, brandId: brand?.id ?? null, newBrandName: brand ? null : nz(brandName), name: f.name.trim(),
      nameOriginal: nz(f.nameOriginal), series: nz(f.series), attrs: product,
      customAttrs: customLeft.value.filter((a) => a.name && a.value),
      tags: tagsText.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
    },
    variant: variantPart,
  })
}
</script>
