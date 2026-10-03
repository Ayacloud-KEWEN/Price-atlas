<template>
  <div v-if="loadError" class="card p-6 text-danger">{{ loadError }}</div>
  <div v-else-if="!data" class="text-sm text-muted">加载中…</div>
  <div v-else>
    <!-- 头部 -->
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <NuxtLink to="/quotes" class="text-xs text-muted hover:underline">← 报价列表</NuxtLink>
        <h1 class="truncate text-xl font-semibold">{{ title }}</h1>
        <div class="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <StatusBadge :status="o.status" />
          <span>观察于 {{ fmtDate(o.observedAt, true) }}</span>
          <span>· 录入于 {{ fmtDate(o.recordedAt, true) }}</span>
          <span v-if="o.timezone">· {{ o.timezone }}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink v-if="o.variantId" :to="`/capture/price?variantId=${o.variantId}${o.merchantId ? '&merchantId=' + o.merchantId : ''}`" class="btn btn-sm">再记一次价格</NuxtLink>
        <NuxtLink v-if="o.productId" :to="`/products/${o.productId}`" class="btn btn-sm">查看商品</NuxtLink>
      </div>
    </div>

    <div v-if="data.photosMissing" class="mb-4 rounded-lg border border-danger bg-danger-50 p-3 text-sm text-danger" role="alert">
      手机端声明了 {{ o.expectedPhotos }} 张照片，服务器只收到 {{ data.attachments.length }} 张，还有 {{ data.photosMissing }} 张未上传完整（请在手机“草稿”中重试）。
    </div>
    <div v-if="o.status === 'void'" class="mb-4 rounded-lg border border-danger bg-danger-50 p-3 text-sm text-danger">
      此记录已于 {{ fmtDate(o.voidedAt, true) }} 作废{{ o.voidReason ? '：' + o.voidReason : '' }}。作废记录保留可追溯信息，不参与分析。
    </div>

    <div class="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <!-- 左：来源凭证 -->
      <div class="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <section class="card p-4" aria-labelledby="ph">
          <h2 id="ph" class="section-title mb-3">来源凭证（{{ data.attachments.length }}）</h2>
          <div v-if="!data.attachments.length" class="rounded-lg border border-dashed border-line p-8 text-center text-sm text-muted">没有照片。</div>
          <template v-else>
            <a :href="`/api/attachments/${cur.id}/file`" target="_blank" rel="noopener">
              <img :src="`/api/attachments/${cur.id}/file`" :alt="`${ATTACHMENT_KINDS[cur.kind]}照片`" class="max-h-[60vh] w-full rounded-lg bg-bg object-contain" />
            </a>
            <div class="mt-3 flex flex-wrap items-center gap-2">
              <button v-for="(a, i) in (data.attachments as any[])" :key="a.id" type="button" class="overflow-hidden rounded-md border-2"
                :class="i === curIdx ? 'border-brand' : 'border-transparent'" :aria-label="`查看第 ${i + 1} 张`" @click="curIdx = i">
                <img :src="`/api/attachments/${a.id}/file`" alt="" class="h-14 w-14 object-cover" loading="lazy" />
              </button>
            </div>
            <div class="mt-3 flex items-center gap-2">
              <select :value="cur.kind" class="input !w-32" aria-label="照片类型" :disabled="o.status === 'void'" @change="setKind(cur.id, ($event.target as HTMLSelectElement).value)">
                <option v-for="(l, k) in ATTACHMENT_KINDS" :key="k" :value="k">{{ l }}</option>
              </select>
              <span class="text-xs text-muted">{{ Math.round(cur.size / 1024) }} KB</span>
              <button v-if="o.status !== 'confirmed' && o.status !== 'void'" class="btn btn-sm btn-danger ml-auto" @click="delPhoto(cur.id)">删除此照片</button>
            </div>
          </template>
          <div v-if="o.status !== 'void'" class="mt-4 border-t border-line pt-3">
            <PhotoPicker v-model="newPhotos" label="补充照片" />
            <button v-if="newPhotos.length" class="btn btn-sm btn-primary mt-2" :disabled="uploading" @click="uploadNew">{{ uploading ? '上传中…' : `上传 ${newPhotos.length} 张` }}</button>
          </div>
        </section>
      </div>

      <!-- 右：核查与编辑 -->
      <div class="space-y-4">
        <!-- 商品关联 -->
        <section class="card p-4" aria-labelledby="lk">
          <h2 id="lk" class="section-title mb-2">商品与规格</h2>
          <div v-if="data.variant" class="rounded-lg border border-brand/40 bg-brand-50 p-3 text-sm">
            <div class="font-medium">{{ [data.variant.brand, data.variant.productName].filter(Boolean).join(' ') }}</div>
            <div class="text-muted">{{ specSummary(data.variant) || '未填写规格' }} · {{ data.categoryPath.join(' › ') }}</div>
            <p class="mt-1 text-xs text-muted">价格记录保存了录入当时的规格快照；之后修改商品资料不会改变这条历史记录。</p>
          </div>
          <div v-else class="rounded-lg border border-dashed border-warn bg-warn-50 p-3 text-sm text-warn">
            尚未关联商品规格。确认前需匹配已有规格，或创建新规格。
            <div class="mt-1 text-xs text-muted">现场记录：{{ o.rawName || '—' }} {{ o.rawSpec ? '· ' + o.rawSpec : '' }}</div>
          </div>
          <div v-if="o.status !== 'void'" class="mt-3 flex flex-wrap gap-2">
            <button class="btn btn-sm" @click="panel = panel === 'match' ? '' : 'match'">{{ data.variant ? '更换关联' : '匹配已有商品' }}</button>
            <button class="btn btn-sm" @click="panel = panel === 'new' ? '' : 'new'">创建新商品 / 规格</button>
          </div>
          <div v-if="panel === 'match'" class="mt-3 space-y-3 border-t border-line pt-3">
            <div v-if="dups && (dups.variants.length || dups.observations.length)" class="rounded-lg bg-warn-50 p-3 text-sm">
              <p class="mb-2 font-medium text-warn">疑似匹配 / 重复（仅提示，请自行判断，不会自动合并）</p>
              <ul class="space-y-2">
                <li v-for="d in dups.variants" :key="d.variantId" class="flex items-center justify-between gap-2">
                  <div class="min-w-0"><span class="font-medium">{{ [d.brand, d.productName].filter(Boolean).join(' ') }}</span>
                    <span class="text-muted"> · {{ specSummary(d) || '无规格' }}</span>
                    <span class="chip ml-1" v-for="r in d.reasons" :key="r">{{ r }}</span></div>
                  <button class="btn btn-sm" :disabled="saving" @click="link(d.variantId)">关联此规格</button>
                </li>
              </ul>
              <ul v-if="dups.observations.length" class="mt-3 space-y-1 border-t border-warn/30 pt-2 text-xs">
                <li v-for="d in dups.observations" :key="d.id">
                  近期相似记录：<NuxtLink :to="`/quotes/${d.id}`" class="underline">{{ d.rawName }}</NuxtLink>
                  {{ fmtMoney(d.amount, d.currency) }} · {{ fmtDate(d.observedAt) }} · {{ BIZ_STATUS[d.status] }}
                  <b v-if="d.samePrice" class="text-warn">（金额相同，可能是重复录入）</b>
                </li>
              </ul>
            </div>
            <VariantSearch @select="(v: any) => link(v.variantId)" />
          </div>
          <div v-if="panel === 'new'" class="mt-3 border-t border-line pt-3">
            <ProductQuickForm :initial="{ name: o.rawName ?? '', categoryId: o.categoryId ?? '' }" submit-label="创建并关联" cancellable :busy="saving"
              :error-msg="productErr" :errors="productErrors" @submit="createAndLink" @cancel="panel = ''" />
          </div>
        </section>

        <!-- 报价 -->
        <section class="card p-4" aria-labelledby="pr">
          <h2 id="pr" class="section-title mb-3">报价（原始记录）</h2>
          <fieldset :disabled="o.status === 'void'" class="space-y-4">
            <div class="grid grid-cols-5 gap-3">
              <div class="col-span-3"><MoneyField v-model="e.amount" label="金额" :error="err.amount" @state="(s: string) => (amountState = s)" /></div>
              <div class="col-span-2">
                <label class="label" for="e-cur">币种</label>
                <input id="e-cur" v-model="e.currency" class="input uppercase" maxlength="3" list="cur-list" :class="{ 'input-error': err.currency }" />
                <datalist id="cur-list"><option v-for="c in CURRENCIES" :key="c" :value="c" /></datalist>
                <p v-if="err.currency" class="err">{{ err.currency }}</p>
              </div>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div><label class="label" for="e-qu">报价单位</label>
                <select id="e-qu" v-model="e.quoteUnit" class="input"><option v-for="(l, k) in QUOTE_UNITS" :key="k" :value="k">{{ l }}</option></select></div>
              <div><label class="label" for="e-qq">金额对应数量</label><input id="e-qq" v-model="e.quoteQty" class="input text-right" inputmode="decimal" /></div>
              <div><label class="label" for="e-qd">包装说明</label><input id="e-qd" v-model="e.quotePackDescription" class="input" /></div>
            </div>
            <div v-if="!data.variant" class="grid gap-3 sm:grid-cols-3">
              <div><label class="label" for="e-su">现场规格：净含量</label><input id="e-su" v-model="e.snapUnitSize" class="input text-right" inputmode="decimal" /></div>
              <div><label class="label" for="e-suu">单位</label>
                <select id="e-suu" v-model="e.snapUnitSizeUnit" class="input"><option value="">—</option><option v-for="(u, k) in MEASURE_UNITS" :key="k" :value="k">{{ u.label }}</option></select></div>
              <div><label class="label" for="e-sp">包装内件数</label><input id="e-sp" v-model="e.snapPackCount" class="input text-right" inputmode="numeric" :class="{ 'input-error': err.snapPackCount }" />
                <p v-if="err.snapPackCount" class="err">{{ err.snapPackCount }}</p></div>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div><label class="label" for="e-st">销售方式</label>
                <select id="e-st" v-model="e.saleType" class="input"><option v-for="(l, k) in SALE_TYPES" :key="k" :value="k">{{ l }}</option></select></div>
              <div><label class="label" for="e-pt">价格类型</label>
                <select id="e-pt" v-model="e.priceType" class="input"><option v-for="(l, k) in PRICE_TYPES" :key="k" :value="k">{{ l }}</option></select></div>
              <div><label class="label" for="e-tax">税费</label>
                <select id="e-tax" v-model="e.taxStatus" class="input"><option v-for="(l, k) in TAX_STATUS" :key="k" :value="k">{{ l }}</option></select></div>
              <MoneyField v-model="e.originalAmount" label="原价" :error="err.originalAmount" />
              <div class="sm:col-span-2"><label class="label" for="e-pc">优惠条件</label><input id="e-pc" v-model="e.promoCondition" class="input" /></div>
              <div><label class="label" for="e-pv">优惠有效期</label><input id="e-pv" v-model="e.promoValidUntil" type="datetime-local" class="input" /></div>
              <div><label class="label" for="e-ship">运费</label>
                <select id="e-ship" v-model="e.shippingStatus" class="input"><option v-for="(l, k) in SHIPPING_STATUS" :key="k" :value="k">{{ l }}</option></select></div>
              <MoneyField v-if="e.shippingStatus === 'paid'" v-model="e.shippingAmount" label="运费金额" :error="err.shippingAmount" />
              <div><label class="label" for="e-stock">库存</label>
                <select id="e-stock" v-model="e.stockStatus" class="input"><option value="">未记录</option><option v-for="(l, k) in STOCK_STATUS" :key="k" :value="k">{{ l }}</option></select></div>
              <div><label class="label" for="e-cond">新旧 / 临期</label>
                <select id="e-cond" v-model="e.condition" class="input"><option value="">未记录</option><option v-for="(l, k) in CONDITIONS" :key="k" :value="k">{{ l }}</option></select></div>
              <div v-if="e.saleType === 'wholesale'"><label class="label" for="e-moq">最低采购量</label><input id="e-moq" v-model="e.minOrderQty" class="input" inputmode="numeric" /></div>
            </div>
          </fieldset>

          <div v-if="o.unitPrices" class="mt-4 rounded-lg bg-brand-50 p-3 text-sm">
            <p class="mb-1 font-medium text-brand">标准化单价（派生值，不替代原始记录）</p>
            <dl class="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              <template v-for="[k, label] in unitRows" :key="k"><template v-if="o.unitPrices[k]">
                <dt class="text-muted">{{ label }}</dt><dd class="num font-medium tabular-nums">{{ fmtMoney(o.unitPrices[k], o.currency) }}</dd></template></template>
            </dl>
            <p v-for="n in o.unitPrices.notes" :key="n" class="mt-1 text-xs text-muted">{{ n }}</p>
            <p v-if="!o.unitPrices.computable && !o.unitPrices.notes.length" class="text-xs text-muted">信息不足，无法换算。</p>
          </div>
        </section>

        <!-- 来源与分类 -->
        <section class="card p-4" aria-labelledby="src">
          <h2 id="src" class="section-title mb-3">来源与市场</h2>
          <fieldset :disabled="o.status === 'void'" class="grid gap-3 sm:grid-cols-2">
            <div><label class="label" for="e-m">商家 / 门店</label>
              <select id="e-m" v-model="e.merchantId" class="input"><option value="">未选择</option>
                <option v-for="m in meta.merchants" :key="m.id" :value="m.id">{{ m.name }}{{ m.storeName ? ' · ' + m.storeName : '' }}</option></select></div>
            <div><label class="label" for="e-mr">来源（原文）</label><input id="e-mr" v-model="e.merchantNameRaw" class="input" /></div>
            <div><label class="label" for="e-mc">销售国家 / 市场</label><input id="e-mc" v-model="e.marketCountry" class="input" /></div>
            <div><label class="label" for="e-mct">城市</label><input id="e-mct" v-model="e.marketCity" class="input" /></div>
            <div><label class="label" for="e-ob">观察时间</label><input id="e-ob" v-model="e.observedAt" type="datetime-local" class="input" /></div>
            <div v-if="!data.variant"><label class="label" for="e-cat">分类</label>
              <select id="e-cat" v-model="e.categoryId" class="input"><option value="">—</option>
                <option v-for="c in categoryOptions" :key="c.id" :value="c.id">{{ '  '.repeat(c.depth) }}{{ c.label }}</option></select></div>
            <div class="sm:col-span-2"><label class="label" for="e-rn">现场记录的名称 / 规格</label>
              <div class="grid gap-2 sm:grid-cols-2"><input id="e-rn" v-model="e.rawName" class="input" /><input v-model="e.rawSpec" class="input" aria-label="规格说明" /></div></div>
            <div class="sm:col-span-2"><label class="label" for="e-url">来源链接</label><input id="e-url" v-model="e.sourceUrl" class="input" /></div>
            <div class="sm:col-span-2"><label class="label" for="e-nt">备注</label><textarea id="e-nt" v-model="e.notes" class="input" rows="2" /></div>
            <div v-if="o.tags?.length" class="sm:col-span-2 text-sm"><span class="text-muted">标签：</span><span v-for="t in o.tags" :key="t" class="chip mr-1">{{ t }}</span></div>
          </fieldset>
        </section>

        <p v-if="saveErr" class="rounded-lg border border-danger bg-danger-50 p-3 text-sm text-danger" role="alert">{{ saveErr }}</p>

        <!-- 操作 -->
        <div v-if="o.status !== 'void'" class="card sticky bottom-16 z-10 flex flex-wrap items-center gap-2 p-3 md:bottom-2">
          <button class="btn btn-primary" :disabled="saving" @click="save()">{{ saving ? '保存中…' : '保存修正' }}</button>
          <button v-if="o.status === 'draft'" class="btn" :disabled="saving" @click="save('pending')">标记为待核查</button>
          <button v-if="o.status !== 'confirmed'" class="btn" :disabled="saving" @click="save('confirmed')">核查通过 · 确认</button>
          <button v-if="o.status === 'confirmed'" class="btn" :disabled="saving" @click="save('pending')">退回待核查</button>
          <button class="btn btn-danger ml-auto" :disabled="saving" @click="showVoid = !showVoid">作废</button>
          <div v-if="showVoid" class="w-full border-t border-line pt-3">
            <label class="label" for="vr">作废原因（保留可追溯信息，不会删除）</label>
            <div class="flex gap-2"><input id="vr" v-model="voidReason" class="input" placeholder="如 重复录入 / 价格看错" />
              <button class="btn btn-danger" :disabled="saving" @click="doVoid">确认作废</button></div>
          </div>
        </div>
        <p v-if="o.status !== 'void'" class="text-xs text-muted">
          “保存修正”会保留修改前后的值（用于更正错误）。如果是价格发生了新的变化，请用上方“再记一次价格”新增一条观察，而不是覆盖这条。
        </p>

        <!-- 修改记录 -->
        <section class="card p-4" aria-labelledby="hs">
          <h2 id="hs" class="section-title mb-3">修改记录</h2>
          <p v-if="!data.history.length" class="text-sm text-muted">暂无。</p>
          <ol class="space-y-3">
            <li v-for="h in data.history" :key="h.id" class="text-sm">
              <div class="flex items-center gap-2"><span class="badge bg-bg text-ink">{{ ACTION_LABEL[h.action] ?? h.action }}</span>
                <span class="text-xs text-muted">{{ fmtDate(h.createdAt, true) }}</span></div>
              <p v-if="h.note" class="text-xs text-muted">{{ h.note }}</p>
              <ul class="mt-1 space-y-0.5 text-xs">
                <li v-for="(c, k) in h.changes" :key="k"><span class="text-muted">{{ FIELD_LABEL[k as string] ?? k }}：</span>
                  <s class="text-danger">{{ show(c.from) }}</s> → <b>{{ show(c.to) }}</b></li>
              </ul>
            </li>
          </ol>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  ATTACHMENT_KINDS, SALE_TYPES, PRICE_TYPES, TAX_STATUS, SHIPPING_STATUS, STOCK_STATUS, CONDITIONS, CURRENCIES,
} from '../../../shared/templates'
import { MEASURE_UNITS, QUOTE_UNITS } from '../../../shared/pricing'
import type { PickedPhoto } from '../../components/PhotoPicker.vue'

const id = String(useRoute().params.id)
const toast = useToast()
const { meta, load, categoryOptions } = useMeta()

const data = ref<any>(null)
const loadError = ref('')
const dups = ref<any>(null)
const curIdx = ref(0)
const panel = ref<'' | 'match' | 'new'>('')
const saving = ref(false)
const saveErr = ref('')
const err = ref<Record<string, string>>({})
const productErr = ref('')
const productErrors = ref<Record<string, string>>({})
const amountState = ref('ok')
const showVoid = ref(false)
const voidReason = ref('')
const newPhotos = ref<PickedPhoto[]>([])
const uploading = ref(false)
const e = reactive<Record<string, any>>({})

const o = computed(() => data.value.observation)
const cur = computed(() => data.value.attachments[Math.min(curIdx.value, data.value.attachments.length - 1)])
const title = computed(() => {
  const s = o.value.snapshot ?? {}
  return o.value.rawName || [s.brand, s.name].filter(Boolean).join(' ') || '未命名记录'
})
const unitRows: [string, string][] = [['perPackage', '整包装'], ['perItem', '每件'], ['per100g', '每100g'], ['perKg', '每公斤'], ['per100ml', '每100ml'], ['perL', '每升']]
const ACTION_LABEL: Record<string, string> = { create: '创建', correct: '修正', relink: '更换关联', status: '状态变更', void: '作废', attachment: '照片' }
const FIELD_LABEL: Record<string, string> = {
  amount: '金额', currency: '币种', quoteUnit: '报价单位', quoteQty: '金额对应数量', saleType: '销售方式', priceType: '价格类型',
  originalAmount: '原价', taxStatus: '税费', shippingStatus: '运费', shippingAmount: '运费金额', status: '状态', variantId: '关联规格',
  productId: '关联商品', categoryId: '分类', merchantId: '商家', observedAt: '观察时间', rawName: '名称', rawSpec: '规格说明',
  notes: '备注', stockStatus: '库存', condition: '新旧', promoCondition: '优惠条件', marketCountry: '销售国家', marketCity: '城市',
  snapUnitSize: '净含量', snapUnitSizeUnit: '净含量单位', snapPackCount: '包装内件数', sourceUrl: '来源链接',
}
const show = (v: unknown) => (v === null || v === undefined || v === '' ? '（空）' : typeof v === 'object' ? JSON.stringify(v) : String(v))

const EDIT_KEYS = ['amount', 'currency', 'quoteUnit', 'quoteQty', 'quotePackDescription', 'saleType', 'priceType', 'originalAmount', 'promoCondition',
  'taxStatus', 'shippingStatus', 'shippingAmount', 'stockStatus', 'condition', 'minOrderQty', 'merchantId', 'merchantNameRaw',
  'marketCountry', 'marketCity', 'sourceUrl', 'notes', 'rawName', 'rawSpec', 'categoryId', 'snapUnitSize', 'snapUnitSizeUnit', 'snapPackCount']

function fill() {
  const ob = o.value
  for (const k of EDIT_KEYS) e[k] = ob[k] ?? ''
  e.observedAt = ob.observedAt ? toLocalInput(new Date(ob.observedAt)) : ''
  e.promoValidUntil = ob.promoValidUntil ? toLocalInput(new Date(ob.promoValidUntil)) : ''
  e.snapUnitSize = ob.snapUnitSize ?? ''
  if (e.snapUnitSize) e.snapUnitSize = String(Number(e.snapUnitSize))
}

async function reload() {
  try {
    data.value = await api(`/api/observations/${id}`)
    fill()
    if (!data.value.variant && data.value.observation.status !== 'void') dups.value = await api(`/api/observations/${id}/duplicates`).catch(() => null)
    if (data.value.variant) dups.value = null
    // 未关联时默认展开匹配面板
    if (!data.value.variant && !panel.value && data.value.observation.status !== 'void') panel.value = 'match'
  } catch (x: any) { loadError.value = x.message }
}
onMounted(async () => { await load().catch(() => {}); await reload() })

function buildPatch(status?: string) {
  const p: Record<string, any> = {}
  for (const k of EDIT_KEYS) {
    if (data.value.variant && k.startsWith('snap')) continue
    if (!data.value.variant && k === 'categoryId') { p[k] = e[k] || null; continue }
    if (k === 'categoryId') continue
    p[k] = e[k] === '' ? null : e[k]
  }
  p.minOrderQty = e.minOrderQty === '' || e.minOrderQty == null ? null : Number(e.minOrderQty)
  p.snapPackCount = e.snapPackCount === '' || e.snapPackCount == null ? null : Number(e.snapPackCount)
  if (e.snapUnitSize) p.snapUnitSize = String(e.snapUnitSize).replace(',', '.')
  p.currency = e.currency ? String(e.currency).toUpperCase() : null
  p.observedAt = e.observedAt ? new Date(e.observedAt).toISOString() : undefined
  p.promoValidUntil = e.promoValidUntil ? new Date(e.promoValidUntil).toISOString() : null
  if (status) p.status = status
  return p
}

async function save(status?: string) {
  saveErr.value = ''; err.value = {}
  if (amountState.value === 'ambiguous') { err.value = { amount: '请先确认金额的含义' }; return }
  saving.value = true
  try {
    const r = await api<{ changes: Record<string, any> }>(`/api/observations/${id}`, { method: 'PATCH', body: buildPatch(status) })
    const n = Object.keys(r.changes).length
    toast.success(n ? `已保存，记录了 ${n} 项修改` : '没有变化')
    await reload()
  } catch (x: any) {
    err.value = x.fields ?? {}
    saveErr.value = Object.keys(err.value).length ? '请修改标红的字段后重试（输入已保留）' : x.message
    if (err.value.variantId) saveErr.value = err.value.variantId + ' —— 请在上方“商品与规格”中匹配或创建。'
  } finally { saving.value = false }
}

async function link(variantId: string) {
  saving.value = true; saveErr.value = ''
  try {
    await api(`/api/observations/${id}`, { method: 'PATCH', body: { variantId, note: '核查时关联规格' } })
    toast.success('已关联商品规格（保留修改记录）')
    panel.value = ''
    await reload()
  } catch (x: any) { saveErr.value = x.message } finally { saving.value = false }
}

async function createAndLink(payload: { product?: any; variant: any }) {
  saving.value = true; productErr.value = ''; productErrors.value = {}
  try {
    await api(`/api/observations/${id}`, { method: 'PATCH', body: { newProduct: payload, note: '核查时创建新商品/规格并关联' } })
    toast.success('已创建新商品并关联')
    panel.value = ''
    await load(true)
    await reload()
  } catch (x: any) {
    productErr.value = x.message
    productErrors.value = Object.fromEntries(Object.entries(x.fields ?? {}).map(([k, v]) => [String(k).replace(/^newProduct\./, ''), v as string]))
  } finally { saving.value = false }
}

async function doVoid() {
  saving.value = true
  try {
    await api(`/api/observations/${id}/void`, { method: 'POST', body: { reason: voidReason.value || null } })
    toast.success('已作废（保留追溯信息）')
    showVoid.value = false
    await reload()
  } catch (x: any) { saveErr.value = x.message } finally { saving.value = false }
}

async function setKind(attId: string, kind: string) {
  try { await api(`/api/attachments/${attId}`, { method: 'PATCH', body: { kind } }); await reload() } catch (x: any) { toast.error(x.message) }
}
async function delPhoto(attId: string) {
  if (!confirm('删除这张照片？')) return
  try { await api(`/api/attachments/${attId}`, { method: 'DELETE' }); curIdx.value = 0; await reload() } catch (x: any) { toast.error(x.message) }
}
async function uploadNew() {
  uploading.value = true
  let ok = 0
  for (const p of newPhotos.value) {
    try {
      const fd = new FormData()
      fd.append('clientId', p.clientId); fd.append('observationId', id); fd.append('kind', p.kind)
      fd.append('file', p.blob, p.name)
      await api('/api/attachments', { method: 'POST', body: fd }); ok++
    } catch (x: any) { toast.error(`上传失败：${x.message}`) }
  }
  uploading.value = false
  if (ok) { toast.success(`已上传 ${ok} 张`); newPhotos.value = []; await reload() }
}
</script>
