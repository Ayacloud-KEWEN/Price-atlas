<template>
  <form class="mx-auto max-w-3xl space-y-5" novalidate @submit.prevent="save('pending', false)">
    <div v-if="metaFromCache" class="rounded-lg bg-warn-50 px-3 py-2 text-sm text-warn">离线中：使用上次缓存的分类与商家资料。</div>

    <!-- ===== 已有商品：选择规格 ===== -->
    <section v-if="mode === 'existing'" class="card space-y-3 p-4" aria-labelledby="sec-variant">
      <h2 id="sec-variant" class="section-title">商品与规格</h2>
      <div v-if="form.variant" class="rounded-lg border border-brand/40 bg-brand-50 p-3">
        <div class="font-medium">{{ [form.variant.brand, form.variant.productName].filter(Boolean).join(' ') }}</div>
        <div class="text-sm text-muted">{{ specSummary(form.variant) || '未填写规格' }}</div>
        <button type="button" class="btn btn-sm mt-2" @click="form.variant = null">更换商品</button>
      </div>
      <VariantSearch v-else @select="pickVariant" />
      <p v-if="errors.variantId" class="err">{{ errors.variantId }}</p>
    </section>

    <!-- ===== 新商品：通用字段 ===== -->
    <section v-if="mode === 'new'" class="card space-y-4 p-4" aria-labelledby="sec-product">
      <h2 id="sec-product" class="section-title">{{ parent ? '为已有商品新增规格' : '商品' }}</h2>
      <div v-if="parent" class="rounded-lg border border-brand/40 bg-brand-50 p-3 text-sm">
        <div class="font-medium">{{ [parent.brand?.name, parent.product.name].filter(Boolean).join(' ') }}</div>
        <div class="text-muted">{{ parent.categoryPath.join(' › ') }}。同系列的不同容量、年份、浓度等会作为独立规格保存。</div>
      </div>
      <div v-if="!parent">
        <label class="label" for="category">品类<span class="text-danger"> *</span></label>
        <select id="category" v-model="form.categoryId" class="input" :class="{ 'input-error': errors.categoryId }" @change="onCategoryChange">
          <option value="" disabled>选择品类…</option>
          <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.label }}</option>
        </select>
        <p v-if="errors.categoryId" class="err">{{ errors.categoryId }}</p>
        <p v-if="orphanNotice" class="mt-2 rounded-lg bg-warn-50 px-3 py-2 text-xs text-warn" role="status">{{ orphanNotice }}</p>
      </div>
      <div v-if="!parent" class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="brand">品牌（可未知）</label>
          <input id="brand" v-model="form.brand" class="input" list="brand-list" autocomplete="off" />
          <datalist id="brand-list"><option v-for="b in meta.brands" :key="b.id" :value="b.name" /></datalist>
        </div>
        <div>
          <label class="label" for="pname">商品名称<span class="text-danger"> *</span></label>
          <input id="pname" v-model="form.name" class="input" :class="{ 'input-error': errors.name }" />
          <p v-if="errors.name" class="err">{{ errors.name }}</p>
        </div>
      </div>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="label" for="usize">{{ tpl.labels.unitSize }}</label>
          <input id="usize" v-model="form.unitSize" class="input text-right" inputmode="decimal" placeholder="无则留空" :class="{ 'input-error': errors.unitSize }" />
        </div>
        <div>
          <label class="label" for="uunit">单位</label>
          <select id="uunit" v-model="form.unitSizeUnit" class="input" :class="{ 'input-error': errors.unitSizeUnit }">
            <option v-for="(u, k) in MEASURE_UNITS" :key="k" :value="k">{{ u.label }}</option>
          </select>
        </div>
        <p v-if="errors.unitSize || errors.unitSizeUnit" class="err col-span-2 !mt-0">{{ errors.unitSize || errors.unitSizeUnit }}</p>
        <div class="col-span-2">
          <label class="label" for="pack">{{ tpl.labels.packCount }}</label>
          <input id="pack" v-model="form.packCount" class="input text-right" inputmode="numeric" placeholder="单件商品可留空" />
          <p class="hint">不适用的项目（如耳机没有净含量）直接留空，不要填虚假数值。</p>
        </div>
      </div>
    </section>

    <!-- ===== 先拍下来 ===== -->
    <section v-if="mode === 'quick'" class="card space-y-4 p-4" aria-labelledby="sec-quick">
      <h2 id="sec-quick" class="section-title">先拍下来，稍后整理</h2>
      <p class="hint">拍摄产品、价签或背标，写一句备注即可。保存为草稿后可在电脑上补全。</p>
      <div>
        <label class="label" for="rawname">看到的商品名称（可选）</label>
        <input id="rawname" v-model="form.rawName" class="input" />
      </div>
      <div>
        <label class="label" for="rawspec">规格说明（可选）</label>
        <input id="rawspec" v-model="form.rawSpec" class="input" placeholder="如 750ml 6瓶装" />
      </div>
    </section>

    <!-- ===== 报价（核心） ===== -->
    <section class="card space-y-4 p-4" aria-labelledby="sec-price">
      <h2 id="sec-price" class="section-title">{{ mode === 'quick' ? '价格（已知则填，可留空）' : '本次报价' }}</h2>
      <div class="grid grid-cols-5 gap-3">
        <div class="col-span-3">
          <MoneyField v-model="form.amount" label="金额" :required="mode !== 'quick'" :error="errors.amount" @state="(s: string) => (amountState = s)" />
        </div>
        <div class="col-span-2">
          <label class="label" for="currency">币种<span v-if="mode !== 'quick'" class="text-danger"> *</span></label>
          <input id="currency" v-model="form.currency" class="input uppercase" list="currency-list" maxlength="3" autocapitalize="characters" :class="{ 'input-error': errors.currency }" />
          <datalist id="currency-list"><option v-for="c in CURRENCIES" :key="c" :value="c" /></datalist>
          <p v-if="errors.currency" class="err">{{ errors.currency }}</p>
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="qunit">报价单位</label>
          <select id="qunit" v-model="form.quoteUnit" class="input">
            <option v-for="(l, k) in QUOTE_UNITS" :key="k" :value="k">{{ l }}</option>
          </select>
          <p v-if="errors.snapPackCount" class="err">{{ errors.snapPackCount }}</p>
        </div>
        <div v-if="mode === 'new' || mode === 'existing'">
          <label class="label" for="qdesc">报价对应的包装说明（可选）</label>
          <input id="qdesc" v-model="form.quotePackDescription" class="input" placeholder="如 整箱6瓶 / 单瓶 / 礼盒" />
        </div>
      </div>
      <div v-if="preview" class="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand" aria-live="polite">
        <span class="font-medium">按所填规格换算（派生值）：</span>
        <span v-if="preview.perPackage">整包装 {{ preview.perPackage }}　</span>
        <span v-if="preview.perItem">每件 {{ preview.perItem }}　</span>
        <span v-if="preview.per100g">每100g {{ preview.per100g }}　</span>
        <span v-if="preview.per100ml">每100ml {{ preview.per100ml }}　</span>
        <span v-if="preview.perKg">每公斤 {{ preview.perKg }}　</span>
        <span v-if="preview.perL">每升 {{ preview.perL }}</span>
        <span class="block text-xs text-muted" v-if="preview.notes.length">{{ preview.notes.join('；') }}</span>
        <span class="block text-xs text-muted">{{ form.currency || '币种' }}；原始金额以上方为准。</span>
      </div>
    </section>

    <!-- ===== 来源 ===== -->
    <section class="card space-y-4 p-4" aria-labelledby="sec-source">
      <h2 id="sec-source" class="section-title">来源</h2>
      <div>
        <label class="label" for="merchant">商家 / 门店 / 网站</label>
        <select id="merchant" v-model="form.merchantId" class="input" @change="onMerchantChange">
          <option value="">未选择</option>
          <option v-for="m in merchantsSorted" :key="m.id" :value="m.id">{{ m.name }}{{ m.storeName ? ' · ' + m.storeName : '' }}（{{ CHANNEL_TYPES[m.channelType] }}）</option>
          <option value="__new">＋ 新建商家 / 门店…</option>
        </select>
      </div>
      <div v-if="form.merchantId === '__new'" class="space-y-3 rounded-lg border border-line bg-bg p-3">
        <div class="grid gap-3 sm:grid-cols-2">
          <div>
            <label class="label" for="nm-name">商家名称<span class="text-danger"> *</span></label>
            <input id="nm-name" v-model="form.newMerchant.name" class="input" :class="{ 'input-error': errors['newMerchant.name'] }" />
            <p v-if="errors['newMerchant.name']" class="err">{{ errors['newMerchant.name'] }}</p>
          </div>
          <div>
            <label class="label" for="nm-store">门店（可选）</label>
            <input id="nm-store" v-model="form.newMerchant.storeName" class="input" />
          </div>
          <div>
            <label class="label" for="nm-ch">渠道类型</label>
            <select id="nm-ch" v-model="form.newMerchant.channelType" class="input">
              <option v-for="(l, k) in CHANNEL_TYPES" :key="k" :value="k">{{ l }}</option>
            </select>
          </div>
          <div>
            <label class="label" for="nm-url">网址（可选）</label>
            <input id="nm-url" v-model="form.newMerchant.url" class="input" inputmode="url" />
          </div>
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="mcountry">销售国家 / 市场</label>
          <input id="mcountry" v-model="form.marketCountry" class="input" placeholder="不会自动使用手机定位" />
        </div>
        <div>
          <label class="label" for="mcity">城市</label>
          <input id="mcity" v-model="form.marketCity" class="input" />
        </div>
      </div>
      <div>
        <label class="label" for="observed">观察时间</label>
        <input id="observed" v-model="form.observedAt" type="datetime-local" class="input" />
        <p class="hint">默认为现在；事后补录请改成实际看到价格的日期。</p>
        <p v-if="errors.observedAt" class="err">{{ errors.observedAt }}</p>
      </div>
    </section>

    <!-- ===== 照片 ===== -->
    <section class="card p-4" aria-labelledby="sec-photo">
      <h2 id="sec-photo" class="sr-only">照片</h2>
      <PhotoPicker v-model="photos" :label="mode === 'quick' ? '拍摄产品 / 价签 / 背标' : '照片（价签、背标等）'" />
    </section>

    <!-- ===== 展开区：品类专属 ===== -->
    <details v-if="mode === 'new' && specificFields.length" class="card p-4" :open="openSpecific">
      <summary class="section-title flex items-center justify-between">
        <span>{{ tpl.label }}专属信息（可稍后补）</span><span class="text-xs text-muted">展开 ▾</span>
      </summary>
      <div class="mt-4 space-y-4">
        <AttrFields :fields="specificFields" :model="form.attrs" :advanced="false" @change="setAttr" />
        <details v-if="specificFields.some((f) => f.advanced)" class="rounded-lg border border-line p-3">
          <summary class="text-sm font-medium">更多专属字段 ▾</summary>
          <div class="mt-3"><AttrFields :fields="specificFields" :model="form.attrs" :advanced="true" @change="setAttr" /></div>
        </details>
      </div>
    </details>

    <!-- ===== 展开区：更多通用信息 ===== -->
    <details v-if="mode === 'new'" class="card p-4">
      <summary class="section-title flex items-center justify-between"><span>更多商品信息</span><span class="text-xs text-muted">展开 ▾</span></summary>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label class="label" for="norig">原文名称</label><input id="norig" v-model="form.nameOriginal" class="input" /></div>
        <div><label class="label" for="series">型号 / 系列</label><input id="series" v-model="form.series" class="input" /></div>
        <div><label class="label" for="barcode">条码（手工录入）</label><input id="barcode" v-model="form.barcode" class="input" inputmode="numeric" /></div>
        <div>
          <label class="label" for="edition">{{ tpl.labels.edition }}</label>
          <input id="edition" v-model="form.edition" class="input" list="edition-list" />
          <datalist id="edition-list"><option v-for="s in tpl.editionSuggestions" :key="s" :value="s" /></datalist>
        </div>
        <div class="sm:col-span-2"><label class="label" for="packdesc">包装说明</label><input id="packdesc" v-model="form.packDescription" class="input" placeholder="如 木盒 / 6支纸箱" /></div>
        <label class="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
          <input v-model="form.isMixedSet" type="checkbox" class="h-5 w-5 accent-brand" />
          混合礼盒 / 成分不同的套装（只保留整套价格，不拆分单品价）
        </label>
        <div class="sm:col-span-2">
          <label class="label" for="tags">标签（逗号分隔）</label>
          <input id="tags" v-model="tagsText" class="input" list="tag-list" placeholder="礼品, 想买, 展会发现" />
          <datalist id="tag-list"><option v-for="t in meta.tags" :key="t.id" :value="t.name" /></datalist>
        </div>
        <div class="sm:col-span-2">
          <div class="mb-1 flex items-center justify-between"><span class="label !mb-0">自定义属性（属性名 + 值）</span>
            <button type="button" class="btn btn-sm" @click="form.customAttrs.push({ name: '', value: '', unit: '' })">＋ 添加</button></div>
          <div v-for="(a, i) in form.customAttrs" :key="i" class="mb-2 grid grid-cols-[1fr_1fr_5rem_auto] gap-2">
            <input v-model="a.name" class="input" placeholder="如 烘焙度" aria-label="属性名" />
            <input v-model="a.value" class="input" placeholder="如 中度" aria-label="属性值" />
            <input v-model="a.unit" class="input" placeholder="单位" aria-label="单位（可选）" />
            <button type="button" class="btn btn-sm btn-danger" aria-label="删除属性" @click="form.customAttrs.splice(i, 1)">删</button>
          </div>
        </div>
      </div>
    </details>

    <!-- ===== 展开区：优惠、税费等 ===== -->
    <details class="card p-4">
      <summary class="section-title flex items-center justify-between"><span>价格条件：优惠 / 税费 / 运费 / 库存</span><span class="text-xs text-muted">展开 ▾</span></summary>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label class="label" for="saletype">销售方式</label>
          <select id="saletype" v-model="form.saleType" class="input"><option v-for="(l, k) in SALE_TYPES" :key="k" :value="k">{{ l }}</option></select></div>
        <div><label class="label" for="ptype">价格类型</label>
          <select id="ptype" v-model="form.priceType" class="input"><option v-for="(l, k) in PRICE_TYPES" :key="k" :value="k">{{ l }}</option></select></div>
        <MoneyField v-model="form.originalAmount" label="原价（可选）" :error="errors.originalAmount" />
        <div><label class="label" for="valid">优惠有效期（可选）</label><input id="valid" v-model="form.promoValidUntil" type="datetime-local" class="input" /></div>
        <div class="sm:col-span-2"><label class="label" for="promo">优惠条件（可选）</label><input id="promo" v-model="form.promoCondition" class="input" placeholder="如 满2件 / 会员专享 / 展会当日" /></div>
        <div><label class="label" for="tax">税费</label>
          <select id="tax" v-model="form.taxStatus" class="input"><option v-for="(l, k) in TAX_STATUS" :key="k" :value="k">{{ l }}</option></select>
          <p class="hint">未知就保持“税费未知”，不会按零处理。</p></div>
        <div><label class="label" for="ship">运费</label>
          <select id="ship" v-model="form.shippingStatus" class="input"><option v-for="(l, k) in SHIPPING_STATUS" :key="k" :value="k">{{ l }}</option></select>
          <p class="hint">“未知”与“免运费”是不同的。</p></div>
        <MoneyField v-if="form.shippingStatus === 'paid'" v-model="form.shippingAmount" label="运费金额" :error="errors.shippingAmount" />
        <div><label class="label" for="stock">库存状态</label>
          <select id="stock" v-model="form.stockStatus" class="input"><option value="">未记录</option><option v-for="(l, k) in STOCK_STATUS" :key="k" :value="k">{{ l }}</option></select></div>
        <div><label class="label" for="cond">新旧 / 临期</label>
          <select id="cond" v-model="form.condition" class="input"><option value="">未记录</option><option v-for="(l, k) in CONDITIONS" :key="k" :value="k">{{ l }}</option></select></div>
        <div v-if="form.saleType === 'wholesale'"><label class="label" for="moq">最低采购量</label><input id="moq" v-model="form.minOrderQty" class="input" inputmode="numeric" /></div>
        <div><label class="label" for="qqty">金额对应数量</label><input id="qqty" v-model="form.quoteQty" class="input text-right" inputmode="decimal" />
          <p class="hint">默认 1；如“2 件共 30”则填 2。</p></div>
        <div class="sm:col-span-2"><label class="label" for="src">来源链接</label><input id="src" v-model="form.sourceUrl" class="input" inputmode="url" placeholder="https://" /></div>
        <div class="sm:col-span-2"><label class="label" for="notes">备注</label><textarea id="notes" v-model="form.notes" class="input" rows="2" /></div>
      </div>
    </details>

    <!-- ===== 提交 ===== -->
    <div v-if="Object.keys(errors).length" class="rounded-lg border border-danger bg-danger-50 p-3 text-sm text-danger" role="alert">
      有 {{ Object.keys(errors).length }} 处需要修改，已在对应字段标出。你也可以先「存为草稿」，稍后再补全。
    </div>
    <div v-if="saveError" class="rounded-lg border border-danger bg-danger-50 p-3 text-sm text-danger" role="alert">{{ saveError }}</div>

    <div class="sticky bottom-16 z-10 -mx-4 flex flex-wrap gap-2 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur md:bottom-0 md:mx-0 md:rounded-xl md:border">
      <button v-if="mode !== 'quick'" class="btn btn-primary flex-1" :disabled="saving">保存</button>
      <button v-if="mode !== 'quick'" type="button" class="btn flex-1" :disabled="saving" @click="save('pending', true)">保存并继续下一件</button>
      <button v-if="mode === 'quick'" type="button" class="btn btn-primary flex-1" :disabled="saving" @click="save('draft', false)">保存为草稿</button>
      <button v-if="mode === 'quick'" type="button" class="btn flex-1" :disabled="saving" @click="save('draft', true)">保存并继续下一件</button>
      <button v-if="mode !== 'quick'" type="button" class="btn" :disabled="saving" @click="save('draft', false)">存为草稿</button>
    </div>
  </form>
</template>

<script setup lang="ts">
import {
  CHANNEL_TYPES, SALE_TYPES, PRICE_TYPES, TAX_STATUS, SHIPPING_STATUS, STOCK_STATUS, CONDITIONS, CURRENCIES, getTemplate, TEMPLATES,
} from '../../shared/templates'
import { computeUnitPrices, MEASURE_UNITS, QUOTE_UNITS } from '../../shared/pricing'
import type { LocalRecord, LocalPhoto } from '../composables/useLocalDb'
import type { PickedPhoto } from './PhotoPicker.vue'

const props = defineProps<{
  mode: 'existing' | 'new' | 'quick'
  variantId?: string
  merchantId?: string
  editId?: string
  /** 给已有商品新增规格（同系列不同容量/年份/浓度） */
  productId?: string
}>()
const parent = ref<any>(null)

const { meta, load, categoryOptions, fieldsFor, categoryById, fromCache: metaFromCache, uncategorizedId } = useMeta()
const sync = useSyncEngine()
const toast = useToast()
const router = useRouter()

const lastCurrency = (() => { try { return localStorage.getItem('pa_currency') || 'EUR' } catch { return 'EUR' } })()

const blank = () => ({
  clientId: uid() as string,
  categoryId: '', brand: '', name: '', nameOriginal: '', series: '', barcode: '',
  unitSize: '', unitSizeUnit: 'ml', packCount: '', packDescription: '', edition: '', isMixedSet: false,
  attrs: {} as Record<string, any>, customAttrs: [] as { name: string; value: string; unit: string }[], productNotes: '',
  variant: null as any,
  rawName: '', rawSpec: '',
  merchantId: '', newMerchant: { name: '', storeName: '', channelType: 'other', url: '', country: '', city: '', defaultCurrency: '' },
  marketCountry: '', marketCity: '', channelType: '',
  observedAt: toLocalInput(),
  amount: '', currency: lastCurrency, quoteUnit: 'item', quoteQty: '1', quotePackDescription: '',
  saleType: 'retail', priceType: 'regular', originalAmount: '', promoCondition: '', promoValidUntil: '',
  taxStatus: 'unknown', shippingStatus: 'unknown', shippingAmount: '', stockStatus: '', minOrderQty: '', condition: '',
  sourceUrl: '', notes: '',
})
const form = reactive(blank())
const photos = ref<PickedPhoto[]>([])
const tagsText = ref('')
const errors = ref<Record<string, string>>({})
const saveError = ref('')
const saving = ref(false)
const amountState = ref('empty')
const orphanNotice = ref('')
const openSpecific = ref(false)

const tpl = computed(() => getTemplate(categoryById(form.categoryId)?.effectiveTemplate))
const specificFields = computed(() => fieldsFor(form.categoryId))
const merchantsSorted = computed(() => [...meta.value.merchants].sort((a, b) => a.name.localeCompare(b.name, 'zh')))

// ---- 初始化 ----
onMounted(async () => {
  await load().catch(() => {})
  if (props.editId) {
    const rec = await localDb.getRecord(props.editId)
    if (rec && rec.syncState !== 'synced' && rec.syncState !== 'syncing') {
      Object.assign(form, JSON.parse(JSON.stringify(rec.form)))
      form.clientId = rec.clientId
      tagsText.value = (rec.form.tags || []).join(', ')
      const ph = await localDb.getPhotos(rec.clientId)
      photos.value = ph.filter((p) => p.blob).map((p) => ({ clientId: p.clientId, blob: p.blob!, name: p.name, kind: p.kind, url: URL.createObjectURL(p.blob!), size: p.size, mime: p.mime }))
      return
    }
    toast.error('这条记录已无法在本机编辑（可能已同步）')
  }
  if (props.mode === 'new' && props.productId) {
    try {
      parent.value = await api(`/api/products/${props.productId}`)
      form.categoryId = parent.value.product.categoryId
      onCategoryChange()
    } catch (e: any) { toast.error(`无法加载商品：${e.message}`) }
  }
  if (props.mode === 'existing' && props.variantId) {
    const rows = await api<any[]>('/api/products/search', { query: { variantId: props.variantId } }).catch(() => [])
    if (rows[0]) pickVariant(rows[0])
  }
  if (props.merchantId && meta.value.merchants.some((m) => m.id === props.merchantId)) {
    form.merchantId = props.merchantId; onMerchantChange()
  } else {
    try { const last = localStorage.getItem('pa_merchant'); if (last && meta.value.merchants.some((m) => m.id === last)) { form.merchantId = last; onMerchantChange() } } catch {}
  }
  if (props.mode === 'quick' && uncategorizedId.value) form.categoryId = uncategorizedId.value
})

function pickVariant(v: any) {
  form.variant = v
  form.quoteUnit = (v.packCount && v.packCount > 1 && getTemplate(v.template).defaultQuoteUnit === 'package') ? 'package' : getTemplate(v.template).defaultQuoteUnit ?? 'item'
}

function onMerchantChange() {
  const m = meta.value.merchants.find((x) => x.id === form.merchantId)
  if (m) {
    // 带入门店的市场与默认币种；允许再修改。不使用手机定位。
    form.marketCountry = m.country ?? ''
    form.marketCity = m.city ?? ''
    form.channelType = m.channelType ?? ''
    if (m.defaultCurrency) form.currency = m.defaultCurrency
  }
}

function onCategoryChange() {
  const t = getTemplate(categoryById(form.categoryId)?.effectiveTemplate)
  if (!form.unitSizeUnit || !form.unitSize) form.unitSizeUnit = t.defaultUnit ?? form.unitSizeUnit
  form.quoteUnit = t.defaultQuoteUnit ?? 'item'
  // 切换品类时已填写的专属信息不能无提示丢失：不适用于新品类的内容转为自定义属性保留
  const keys = new Set(fieldsFor(form.categoryId).map((f) => f.key))
  const all = new Map<string, string>()
  for (const [k, v] of Object.entries(form.attrs)) {
    if (v === '' || v === null || v === undefined || v === false || keys.has(k)) continue
    all.set(k, String(v))
  }
  if (all.size) {
    for (const [k, v] of all) {
      form.customAttrs.push({ name: knownLabels.get(k) ?? k, value: v, unit: '' })
      delete form.attrs[k]
    }
    orphanNotice.value = `已填写的 ${all.size} 项信息不适用于新品类，已保留为“自定义属性”（在“更多商品信息”中查看）。`
  } else orphanNotice.value = ''
  openSpecific.value = false
}
const knownLabels = new Map(Object.values(TEMPLATES).flatMap((t) => t.fields).map((f) => [f.key, f.label]))

function setAttr(key: string, value: unknown) { form.attrs[key] = value; if (key === 'nonVintage' && value) form.attrs.harvestYear = '' }

// ---- 换算预览（派生值） ----
const specForCalc = computed(() => {
  if (props.mode === 'existing' && form.variant) {
    const v = form.variant
    return { packCount: v.packCount, unitSize: v.unitSize, unitSizeUnit: v.unitSizeUnit, isMixedSet: v.isMixedSet }
  }
  return { packCount: toInt(form.packCount), unitSize: form.unitSize ? normNumber(form.unitSize) : null, unitSizeUnit: form.unitSize ? form.unitSizeUnit : null, isMixedSet: form.isMixedSet }
})
const preview = computed(() => {
  if (!form.amount) return null
  const r = computeUnitPrices({ amount: form.amount, quoteUnit: form.quoteUnit, quoteQty: form.quoteQty || '1', ...specForCalc.value })
  return r.computable || r.notes.length ? r : null
})

// ---- 工具 ----
function normNumber(s: string | number | null | undefined) {
  if (s === null || s === undefined || String(s).trim() === '') return null
  const r = parseAmountInputLoose(String(s))
  return r
}
function parseAmountInputLoose(s: string): string | null {
  const t = s.trim().replace(',', '.')
  return /^\d+(\.\d+)?$/.test(t) ? t : null
}
function toInt(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined || String(s).trim() === '') return null
  const n = Number(String(s).trim())
  return Number.isInteger(n) && n >= 0 ? n : null
}
const nz = (s: any) => (s === '' || s === undefined ? null : s)
const iso = (s: string) => (s ? new Date(s).toISOString() : null)

function splitAttrs() {
  const defs = fieldsFor(form.categoryId)
  const product: Record<string, any> = {}; const variant: Record<string, any> = {}
  for (const f of defs) {
    let v = form.attrs[f.key]
    if (v === '' || v === undefined || v === null || (f.type === 'bool' && !v)) continue
    if (f.type === 'number' || f.type === 'year') { const n = Number(String(v).replace(',', '.')); if (!Number.isNaN(n)) v = n }
    ;(f.level === 'variant' ? variant : product)[f.key] = v
  }
  return { product, variant }
}

function validate(status: 'draft' | 'pending') {
  const e: Record<string, string> = {}
  if (props.mode === 'new') {
    if (!parent.value && (status === 'pending' || form.name || form.categoryId)) {
      if (!form.categoryId) e.categoryId = '请选择品类（不确定可选“待分类”）'
      if (!form.name.trim()) e.name = '请填写商品名称'
    }
    if (form.unitSize && !normNumber(form.unitSize)) e.unitSize = '净含量应为数字（可用小数点或小数逗号）'
    if (form.unitSize && normNumber(form.unitSize) && !form.unitSizeUnit) e.unitSizeUnit = '请选择单位'
    if (form.packCount && toInt(form.packCount) === null) e.packCount = '包装数量应为整数'
  }
  if (props.mode === 'existing' && status === 'pending' && !form.variant) e.variantId = '请先选择商品规格'
  if (form.merchantId === '__new' && !form.newMerchant.name.trim()) e['newMerchant.name'] = '请填写商家名称'
  if (amountState.value === 'ambiguous') e.amount = '请先确认金额的含义（小数还是千分位）'
  else if (amountState.value === 'error') e.amount = '金额格式不正确'
  if (status === 'pending') {
    if (!form.amount && amountState.value !== 'ambiguous') e.amount = '请填写金额（暂时没有可「存为草稿」）'
    if (!/^[A-Za-z]{3}$/.test(form.currency)) e.currency = '请填写 3 位币种代码，如 EUR'
    if (form.quoteUnit === 'package' && specForCalc.value.packCount == null && !(props.mode === 'existing')) {
      e.snapPackCount = '按整包装报价时请填写包装内件数；不确定可把报价单位改为“每件”'
    }
  } else if (form.amount && !/^[A-Za-z]{3}$/.test(form.currency)) e.currency = '已填写金额时请填写币种'
  if (form.shippingStatus === 'paid' && !form.shippingAmount) e.shippingAmount = '另付运费请填写运费金额'
  if (form.priceType === 'promo' && form.originalAmount && form.amount && Number(form.originalAmount) < Number(form.amount)) e.originalAmount = '原价低于促销价，请核对'
  return e
}

function buildPayload(status: 'draft' | 'pending') {
  const tags = tagsText.value.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
  const m = meta.value
  const payload: Record<string, any> = {
    clientId: form.clientId, status,
    recordedAt: new Date().toISOString(),
    observedAt: iso(form.observedAt) ?? new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    amount: nz(form.amount), currency: form.currency ? form.currency.toUpperCase() : null,
    quoteUnit: form.quoteUnit, quoteQty: form.quoteQty || '1', quotePackDescription: nz(form.quotePackDescription),
    saleType: form.saleType, priceType: form.priceType, originalAmount: nz(form.originalAmount),
    promoCondition: nz(form.promoCondition), promoValidUntil: iso(form.promoValidUntil),
    taxStatus: form.taxStatus, shippingStatus: form.shippingStatus, shippingAmount: nz(form.shippingAmount),
    stockStatus: nz(form.stockStatus), minOrderQty: toInt(form.minOrderQty), condition: nz(form.condition),
    sourceUrl: nz(form.sourceUrl), notes: nz(form.notes),
    marketCountry: nz(form.marketCountry), marketCity: nz(form.marketCity), channelType: nz(form.channelType),
    tags,
  }
  if (form.merchantId === '__new') {
    payload.newMerchant = {
      ...Object.fromEntries(Object.entries(form.newMerchant).map(([k, v]) => [k, nz(v)])),
      country: nz(form.marketCountry), city: nz(form.marketCity), defaultCurrency: form.currency ? form.currency.toUpperCase() : null,
    }
    payload.channelType = form.newMerchant.channelType
  } else if (form.merchantId) payload.merchantId = form.merchantId

  if (props.mode === 'existing') {
    payload.variantId = form.variant?.variantId ?? null
    payload.productId = form.variant?.productId ?? null
    payload.rawName = form.variant ? [form.variant.brand, form.variant.productName].filter(Boolean).join(' ') : null
  } else if (props.mode === 'new') {
    const { product, variant } = splitAttrs()
    const brandName = form.brand.trim()
    const brand = brandName ? m.brands.find((b: any) => b.name.toLowerCase() === brandName.toLowerCase()) : null
    payload.categoryId = nz(form.categoryId)
    payload.rawName = [brandName, form.name].filter(Boolean).join(' ') || null
    payload.rawSpec = nz(specSummary({ packCount: toInt(form.packCount), unitSize: form.unitSize, unitSizeUnit: form.unitSize ? form.unitSizeUnit : null, edition: form.edition }))
    const variantPart = {
      barcode: nz(form.barcode), unitSize: form.unitSize ? normNumber(form.unitSize) : null,
      unitSizeUnit: form.unitSize ? form.unitSizeUnit : null, packCount: toInt(form.packCount),
      packDescription: nz(form.packDescription), edition: nz(form.edition), isMixedSet: form.isMixedSet, attrs: variant,
    }
    if (parent.value) {
      payload.rawName = [parent.value.brand?.name, parent.value.product.name].filter(Boolean).join(' ')
      payload.productId = parent.value.product.id
      payload.categoryId = parent.value.product.categoryId
      payload.newVariant = { productId: parent.value.product.id, variant: variantPart }
    } else if (form.name.trim() && form.categoryId) {
      payload.newProduct = {
        product: {
          categoryId: form.categoryId, brandId: brand?.id ?? null, newBrandName: brand ? null : nz(brandName),
          name: form.name.trim(), nameOriginal: nz(form.nameOriginal), series: nz(form.series),
          attrs: product, customAttrs: form.customAttrs.filter((a) => a.name.trim() && a.value.trim()).map((a) => ({ name: a.name.trim(), value: a.value.trim(), ...(a.unit ? { unit: a.unit } : {}) })),
          notes: nz(form.productNotes), tags,
        },
        variant: variantPart,
      }
    }
  } else {
    payload.rawName = nz(form.rawName.trim()); payload.rawSpec = nz(form.rawSpec.trim())
    payload.categoryId = nz(form.categoryId)
  }
  return payload
}

async function save(status: 'draft' | 'pending', next: boolean) {
  saveError.value = ''
  errors.value = validate(status)
  if (Object.keys(errors.value).length) {
    await nextTick()
    document.querySelector('.input-error, .err')?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    return
  }
  if (status === 'draft' && props.mode === 'quick' && !photos.value.length && !form.rawName.trim() && !form.notes.trim()) {
    saveError.value = '请至少拍一张照片或写一点备注，否则没有可整理的内容'
    return
  }
  saving.value = true
  try {
    const payload = buildPayload(status)
    const title = payload.rawName || (props.mode === 'quick' ? '未命名（先拍下来）' : '未命名商品')
    const rec: LocalRecord = {
      clientId: form.clientId, createdAt: Date.now(), updatedAt: Date.now(), mode: props.mode,
      title, subtitle: payload.amount ? `${payload.amount} ${payload.currency ?? ''}` : '未填价格',
      form: JSON.parse(JSON.stringify({ ...form, variant: form.variant, tags: payload.tags })),
      payload, syncState: sync.online.value ? 'pending' : 'local', autoQueue: true, photoCount: photos.value.length,
    }
    if (props.editId) { const old = await localDb.getRecord(props.editId); if (old) rec.createdAt = old.createdAt }
    const localPhotos: LocalPhoto[] = photos.value.map((p) => ({
      clientId: p.clientId, recordId: rec.clientId, kind: p.kind, name: p.name, size: p.size, mime: p.mime, state: 'queued', blob: p.blob,
    }))
    await localDb.saveRecord(rec, localPhotos) // 先落本机，再同步
    try { localStorage.setItem('pa_currency', form.currency || 'EUR'); if (form.merchantId && form.merchantId !== '__new') localStorage.setItem('pa_merchant', form.merchantId) } catch {}
    await sync.refresh()
    sync.syncAll() // 在线则立即同步；离线则等待 online 事件
    toast.success(status === 'draft' ? '已存为草稿（先保存在本机，联网后同步）' : '已保存到本机，正在同步…')
    if (next) resetForNext()
    else await router.push('/drafts')
  } catch (e: any) {
    saveError.value = e?.message || '保存失败'
  } finally { saving.value = false }
}

/** 保存并继续下一件：保留门店与市场，清空商品、价格和照片 */
function resetForNext() {
  const keep = { merchantId: form.merchantId, newMerchant: form.merchantId === '__new' ? { ...form.newMerchant } : form.newMerchant, marketCountry: form.marketCountry, marketCity: form.marketCity, channelType: form.channelType, currency: form.currency }
  Object.assign(form, blank(), keep)
  if (form.merchantId === '__new') form.merchantId = '__new'
  photos.value = []; tagsText.value = ''; errors.value = {}; orphanNotice.value = ''
  amountState.value = 'empty'
  if (props.mode === 'quick' && uncategorizedId.value) form.categoryId = uncategorizedId.value
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>
