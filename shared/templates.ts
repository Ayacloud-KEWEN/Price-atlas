/**
 * 品类模板：元数据驱动的表单字段。
 * 通用字段（品牌、名称、净含量等）存放在数据库列中；
 * 这里定义的专属字段存入 products.attrs / variants.attrs (JSONB)。
 */
export type FieldType = 'text' | 'textarea' | 'number' | 'year' | 'select' | 'bool'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  /** product = 同系列共享；variant = 随具体规格变化 */
  level: 'product' | 'variant'
  options?: { value: string; label: string }[]
  unit?: string
  placeholder?: string
  help?: string
  /** 放入“更多信息”折叠区 */
  advanced?: boolean
}

const opt = (...pairs: string[]) => pairs.map((p) => {
  const [value, label] = p.split('=')
  return { value: value!, label: label ?? value! }
})

const F: Record<string, FieldDef> = {
  // ---- 鱼子酱 ----
  speciesZh: { key: 'speciesZh', label: '鱼种（中文）', type: 'text', level: 'product', placeholder: '如 俄罗斯鲟 / 西伯利亚鲟' },
  speciesLatin: { key: 'speciesLatin', label: '学名', type: 'text', level: 'product', placeholder: 'Acipenser gueldenstaedtii' },
  farmOrigin: { key: 'farmOrigin', label: '养殖产地', type: 'text', level: 'product', help: '养殖/生产地，不同于品牌所在地和销售市场' },
  gradeOriginal: { key: 'gradeOriginal', label: '品牌等级（原文）', type: 'text', level: 'product', help: '照原文记录（Royal、Imperial 等），不同品牌不自动视为同级' },
  processing: {
    key: 'processing', label: '加工方式', type: 'select', level: 'variant',
    options: opt('malossol=Malossol（低盐）', 'pasteurized=巴氏杀菌', 'pressed=压制', 'salted=重盐', 'other=其他', 'unknown=未知'),
  },
  grainSize: { key: 'grainSize', label: '颗粒大小', type: 'text', level: 'variant', unit: 'mm', advanced: true, placeholder: '如 2.8–3.0' },

  // ---- 酒类 ----
  producer: { key: 'producer', label: '生产商 / 酒庄 / 酒厂', type: 'text', level: 'product' },
  cuvee: { key: 'cuvee', label: '酒款 / 系列', type: 'text', level: 'product' },
  country: { key: 'country', label: '生产国家', type: 'text', level: 'product' },
  region: { key: 'region', label: '产区', type: 'text', level: 'product' },
  appellation: { key: 'appellation', label: '法定产区 / 等级（原文）', type: 'text', level: 'product', advanced: true, placeholder: 'AOC / DOCG / Grand Cru …' },
  grapes: { key: 'grapes', label: '葡萄品种', type: 'text', level: 'product', advanced: true },
  harvestYear: { key: 'harvestYear', label: '葡萄采收年份', type: 'year', level: 'variant', help: '采收年份（Vintage），与装瓶年份、陈年年数是不同字段' },
  nonVintage: { key: 'nonVintage', label: '无年份 (NV)', type: 'bool', level: 'variant' },
  bottlingYear: { key: 'bottlingYear', label: '装瓶年份', type: 'year', level: 'variant', advanced: true },
  ageYears: { key: 'ageYears', label: '陈年年数', type: 'number', level: 'variant', unit: '年', advanced: true },
  ageStatement: { key: 'ageStatement', label: '陈年标示', type: 'text', level: 'variant', advanced: true, placeholder: 'Reserva / 12 Years / XO …' },
  abv: { key: 'abv', label: '酒精度', type: 'number', level: 'variant', unit: '% vol' },

  // ---- 香水 ----
  concentration: {
    key: 'concentration', label: '浓度 / 版本', type: 'select', level: 'variant',
    options: opt('edt=EDT', 'edp=EDP', 'parfum=Parfum', 'cologne=Cologne', 'other=其他', 'unknown=未知'),
  },
  form: {
    key: 'form', label: '形态', type: 'select', level: 'variant',
    options: opt('regular=普通瓶', 'refill=补充装', 'travel=旅行装', 'miniature=试用装', 'sample=小样', 'decant=分装', 'set=套装', 'other=其他'),
  },
  packagingState: {
    key: 'packagingState', label: '包装状态', type: 'select', level: 'variant', advanced: true,
    options: opt('sealed=全新密封', 'boxed=有盒', 'unboxed=无盒', 'tester=Tester', 'used=已开封', 'unknown=未知'),
  },
  setContents: { key: 'setContents', label: '套装内容', type: 'textarea', level: 'variant', advanced: true, placeholder: '如 50ml EDP + 75ml 身体乳' },
}

const pick = (...keys: string[]) => keys.map((k) => F[k]!)

export interface TemplateDef {
  key: string
  label: string
  fields: FieldDef[]
  /** 包装数量 / 净含量的表单文案 */
  labels: { packCount: string; unitSize: string; edition: string }
  /** 销售规格/版本的常用建议 */
  editionSuggestions: string[]
  /** 默认净含量单位 */
  defaultUnit?: string
  /** 默认报价单位 */
  defaultQuoteUnit?: string
}

export const TEMPLATES: Record<string, TemplateDef> = {
  generic: {
    key: 'generic', label: '通用', fields: [],
    labels: { packCount: '包装数量', unitSize: '净含量（单件）', edition: '销售规格 / 版本' },
    editionSuggestions: [],
  },
  caviar: {
    key: 'caviar', label: '鱼子酱',
    fields: pick('speciesZh', 'speciesLatin', 'farmOrigin', 'gradeOriginal', 'processing', 'grainSize'),
    labels: { packCount: '每盒罐数', unitSize: '单罐净重', edition: '销售规格 / 版本' },
    editionSuggestions: ['普通装', '礼盒', '限定版'],
    defaultUnit: 'g', defaultQuoteUnit: 'package',
  },
  alcohol_other: {
    key: 'alcohol_other', label: '其他酒类',
    fields: pick('producer', 'cuvee', 'country', 'region', 'abv', 'ageStatement', 'bottlingYear'),
    labels: { packCount: '每箱瓶数', unitSize: '单瓶容量', edition: '包装 / 版本' },
    editionSuggestions: ['普通装', '礼盒', '限定版'],
    defaultUnit: 'ml', defaultQuoteUnit: 'item',
  },
  wine: {
    key: 'wine', label: '葡萄酒',
    fields: pick('producer', 'cuvee', 'country', 'region', 'harvestYear', 'nonVintage', 'abv', 'grapes', 'appellation', 'ageStatement', 'bottlingYear', 'ageYears'),
    labels: { packCount: '每箱瓶数', unitSize: '单瓶容量', edition: '包装 / 版本' },
    editionSuggestions: ['普通装', '礼盒', '限定版'],
    defaultUnit: 'ml', defaultQuoteUnit: 'item',
  },
  sparkling: {
    key: 'sparkling', label: '起泡酒',
    fields: pick('producer', 'cuvee', 'country', 'region', 'harvestYear', 'nonVintage', 'abv', 'grapes', 'appellation', 'ageStatement', 'bottlingYear', 'ageYears'),
    labels: { packCount: '每箱瓶数', unitSize: '单瓶容量', edition: '包装 / 版本' },
    editionSuggestions: ['普通装', '礼盒', '限定版'],
    defaultUnit: 'ml', defaultQuoteUnit: 'item',
  },
  spirits: {
    key: 'spirits', label: '烈酒',
    fields: pick('producer', 'cuvee', 'country', 'region', 'abv', 'ageStatement', 'ageYears', 'bottlingYear', 'harvestYear', 'appellation'),
    labels: { packCount: '每箱瓶数', unitSize: '单瓶容量', edition: '包装 / 版本' },
    editionSuggestions: ['普通装', '礼盒', '限定版'],
    defaultUnit: 'ml', defaultQuoteUnit: 'item',
  },
  beer: {
    key: 'beer', label: '啤酒',
    fields: pick('producer', 'cuvee', 'country', 'region', 'abv'),
    labels: { packCount: '每箱/每组瓶（罐）数', unitSize: '单瓶（罐）容量', edition: '包装 / 版本' },
    editionSuggestions: ['瓶装', '罐装', '桶装', '礼盒'],
    defaultUnit: 'ml', defaultQuoteUnit: 'package',
  },
  perfume: {
    key: 'perfume', label: '香水',
    fields: pick('concentration', 'form', 'packagingState', 'setContents'),
    labels: { packCount: '包装数量', unitSize: '容量', edition: '版本 / 限定款' },
    editionSuggestions: ['标准版', '限定版', '礼盒'],
    defaultUnit: 'ml', defaultQuoteUnit: 'item',
  },
}

export const TEMPLATE_OPTIONS = Object.values(TEMPLATES).map((t) => ({ value: t.key, label: t.label }))

export function getTemplate(key?: string | null): TemplateDef {
  return TEMPLATES[key || 'generic'] ?? TEMPLATES.generic!
}

/** 自定义属性定义（来自数据库 attribute_defs）转为表单字段 */
export interface AttributeDefRow {
  key: string; label: string; type: 'text' | 'number' | 'enum' | 'measure'
  unit?: string | null; options?: string[] | null
}
export function attributeDefToField(d: AttributeDefRow): FieldDef {
  return {
    key: `x_${d.key}`, label: d.label, level: 'product', advanced: false,
    type: d.type === 'number' || d.type === 'measure' ? 'number' : d.type === 'enum' ? 'select' : 'text',
    unit: d.unit ?? undefined,
    options: d.type === 'enum' ? (d.options ?? []).map((o) => ({ value: o, label: o })) : undefined,
  }
}

export const CHANNEL_TYPES: Record<string, string> = {
  official: '官网', specialty: '专业零售', supermarket: '超市', ecommerce: '电商',
  wholesale: '批发', expo: '展会', other: '其他',
}
export const SALE_TYPES: Record<string, string> = { retail: '零售', wholesale: '批发' }
export const PRICE_TYPES: Record<string, string> = { regular: '普通价', promo: '促销价', member: '会员价', other: '其他条件价' }
export const TAX_STATUS: Record<string, string> = { included: '含税', excluded: '未税', unknown: '税费未知' }
export const SHIPPING_STATUS: Record<string, string> = {
  unknown: '运费未知', free: '免运费', included: '运费已含', paid: '另付运费',
}
export const STOCK_STATUS: Record<string, string> = { in_stock: '有货', low: '少量', out: '缺货', preorder: '预订', unknown: '未知' }
export const CONDITIONS: Record<string, string> = { new: '全新', near_expiry: '临期', used: '二手/开封', unknown: '未知' }
export const BIZ_STATUS: Record<string, string> = { draft: '草稿', pending: '待核查', confirmed: '已确认', void: '已作废' }
export const ATTACHMENT_KINDS: Record<string, string> = { front: '正面', back: '背标', price_tag: '价签', other: '其他' }
export const CURRENCIES = ['EUR', 'CNY', 'USD', 'GBP', 'JPY', 'HKD', 'CHF', 'AUD', 'CAD', 'SGD', 'KRW', 'RUB', 'TRY', 'AED']
