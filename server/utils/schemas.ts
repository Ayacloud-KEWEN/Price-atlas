import { z } from 'zod'

const emptyToNull = <T extends z.ZodTypeAny>(s: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? null : v), s.nullable())

export const uuid = z.string().uuid()
export const decimal = (max = 99999999) =>
  z.string().regex(/^\d+(\.\d{1,4})?$/, '金额/数值格式不正确（最多 4 位小数）').refine((v) => Number(v) <= max, '数值过大')
export const optDecimal = (max?: number) => emptyToNull(decimal(max))
export const optText = (max = 500) => emptyToNull(z.string().trim().max(max))
export const reqText = (max = 300) => z.string().trim().min(1, '必填').max(max)
export const isoDate = z.string().refine((v) => !Number.isNaN(Date.parse(v)), '日期格式不正确')
export const optIso = emptyToNull(isoDate)
export const optUuid = emptyToNull(uuid)
export const optInt = (max = 100000) => emptyToNull(z.number().int().min(0).max(max))

export const MEASURE = z.enum(['g', 'kg', 'oz', 'ml', 'cl', 'l', 'floz'])

export const attrsSchema = z.record(z.string().max(60), z.union([z.string().max(1000), z.number(), z.boolean(), z.null()])).default({})
export const customAttrsSchema = z.array(z.object({
  name: z.string().trim().min(1).max(60), value: z.string().trim().max(300), unit: z.string().trim().max(20).optional(),
})).max(50).default([])

export const variantInput = z.object({
  label: optText(200),
  barcode: optText(64),
  unitSize: optDecimal(1_000_000),
  unitSizeUnit: emptyToNull(MEASURE),
  packCount: optInt(100000),
  packDescription: optText(200),
  edition: optText(100),
  isMixedSet: z.boolean().default(false),
  attrs: attrsSchema,
  notes: optText(2000),
}).refine((v) => !v.unitSize || v.unitSizeUnit, { path: ['unitSizeUnit'], message: '填写了净含量，请选择单位' })

export const productInput = z.object({
  categoryId: uuid,
  brandId: optUuid,
  newBrandName: optText(120),
  name: reqText(200),
  nameOriginal: optText(200),
  series: optText(200),
  attrs: attrsSchema,
  customAttrs: customAttrsSchema,
  notes: optText(2000),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
})

export const merchantInput = z.object({
  name: reqText(120),
  storeName: optText(120),
  channelType: z.enum(['official', 'specialty', 'supermarket', 'ecommerce', 'wholesale', 'expo', 'other']).default('other'),
  url: optText(500),
  country: optText(60),
  city: optText(60),
  defaultCurrency: emptyToNull(z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, '币种应为 3 位代码')),
  notes: optText(1000),
})

const priceFields = {
  amount: optDecimal(),
  currency: emptyToNull(z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, '币种应为 3 位代码')),
  quoteUnit: z.enum(['package', 'item', 'kg', 'l']).default('item'),
  quoteQty: decimal(1_000_000).default('1'),
  quotePackDescription: optText(200),
  saleType: z.enum(['retail', 'wholesale']).default('retail'),
  priceType: z.enum(['regular', 'promo', 'member', 'other']).default('regular'),
  originalAmount: optDecimal(),
  promoCondition: optText(300),
  promoValidUntil: optIso,
  taxStatus: z.enum(['included', 'excluded', 'unknown']).default('unknown'),
  shippingStatus: z.enum(['unknown', 'free', 'included', 'excluded', 'paid']).default('unknown'),
  shippingAmount: optDecimal(),
  stockStatus: emptyToNull(z.enum(['in_stock', 'low', 'out', 'preorder', 'unknown'])),
  minOrderQty: optInt(),
  condition: emptyToNull(z.enum(['new', 'near_expiry', 'used', 'unknown'])),
  sourceUrl: optText(1000),
  notes: optText(3000),
  rawName: optText(300),
  rawSpec: optText(300),
  merchantNameRaw: optText(200),
  marketCountry: optText(60),
  marketCity: optText(60),
  channelType: emptyToNull(z.enum(['official', 'specialty', 'supermarket', 'ecommerce', 'wholesale', 'expo', 'other'])),
  observedAt: isoDate,
  timezone: optText(60),
  // 无规格时由现场录入的规格快照
  snapUnitSize: optDecimal(1_000_000),
  snapUnitSizeUnit: emptyToNull(MEASURE),
  snapPackCount: optInt(100000),
  snapIsMixedSet: z.boolean().default(false),
}

export const observationCreate = z.object({
  clientId: z.string().min(8).max(80),
  status: z.enum(['draft', 'pending', 'confirmed']).default('pending'),
  variantId: optUuid,
  productId: optUuid,
  categoryId: optUuid,
  newProduct: z.object({ product: productInput, variant: variantInput }).nullish(),
  /** 给已有商品（系列）新增一个规格，并关联到本次观察 */
  newVariant: z.object({ productId: uuid, variant: variantInput }).nullish(),
  merchantId: optUuid,
  newMerchant: merchantInput.nullish(),
  recordedAt: isoDate,
  expectedPhotos: z.number().int().min(0).max(50).default(0),
  tags: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  ...priceFields,
})

export const observationPatch = z.object({
  status: z.enum(['draft', 'pending', 'confirmed']),
  variantId: optUuid,
  productId: optUuid,
  categoryId: optUuid,
  newProduct: z.object({ product: productInput, variant: variantInput }).nullish(),
  newVariant: z.object({ productId: uuid, variant: variantInput }).nullish(),
  merchantId: optUuid,
  newMerchant: merchantInput.nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(30),
  note: optText(300),
  ...priceFields,
}).partial()

/** Zod 4 会对 .partial() 里的 default 字段补默认值，PATCH 时会悄悄覆盖旧数据。这里只保留请求体里真正出现的键。 */
export function parsePartial<T extends z.ZodTypeAny>(schema: T, raw: unknown): Partial<z.infer<T>> {
  const parsed = schema.parse(raw) as Record<string, unknown>
  const src = (raw ?? {}) as Record<string, unknown>
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => k in src)) as Partial<z.infer<T>>
}
