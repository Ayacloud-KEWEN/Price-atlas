import {
  pgTable, uuid, text, timestamp, numeric, integer, boolean, jsonb, index, uniqueIndex, primaryKey,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

const id = () => uuid('id').primaryKey().default(sql`gen_random_uuid()`)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

/** 分类树。template 决定专属表单，子分类未设置时继承父分类。 */
export const categories = pgTable('categories', {
  id: id(),
  parentId: uuid('parent_id'),
  name: text('name').notNull(),
  template: text('template'),
  /** 系统预置的“待分类”等特殊分类 */
  systemKey: text('system_key'),
  sortOrder: integer('sort_order').notNull().default(0),
  archived: boolean('archived').notNull().default(false),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('categories_system_key_uq').on(t.systemKey)])

/** 自定义属性定义（可提升为品类表单字段）。类型：text / number / enum / measure(带单位数值) */
export const attributeDefs = pgTable('attribute_defs', {
  id: id(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  label: text('label').notNull(),
  type: text('type').notNull().default('text'),
  unit: text('unit'),
  options: jsonb('options').$type<string[]>(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('attribute_defs_cat_key_uq').on(t.categoryId, t.key)])

export const brands = pgTable('brands', {
  id: id(),
  name: text('name').notNull(),
  nameOriginal: text('name_original'),
  /** 品牌所在地（≠ 生产地 ≠ 销售市场） */
  country: text('country'),
  notes: text('notes'),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('brands_name_uq').on(sql`lower(${t.name})`)])

export const tags = pgTable('tags', {
  id: id(),
  name: text('name').notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('tags_name_uq').on(sql`lower(${t.name})`)])

/** 商品（系列）：表示“是什么”。不同容量/年份/浓度等是 variants。 */
export const products = pgTable('products', {
  id: id(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  brandId: uuid('brand_id').references(() => brands.id),
  name: text('name').notNull(),
  nameOriginal: text('name_original'),
  /** 型号或系列 */
  series: text('series'),
  /** 同系列共享的品类专属字段 */
  attrs: jsonb('attrs').$type<Record<string, unknown>>().notNull().default({}),
  /** 临时自定义属性：[{name, value, unit?}] */
  customAttrs: jsonb('custom_attrs').$type<{ name: string; value: string; unit?: string }[]>().notNull().default([]),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('products_category_idx').on(t.categoryId), index('products_brand_idx').on(t.brandId)])

/** 商品规格：容量、年份、浓度、包装数量、版本各自独立。 */
export const variants = pgTable('variants', {
  id: id(),
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  /** 规格说明（人读），如 “750ml × 6 瓶 礼盒” */
  label: text('label'),
  barcode: text('barcode'),
  /** 净含量（单件）。不适用时为空 */
  unitSize: numeric('unit_size', { precision: 14, scale: 4 }),
  unitSizeUnit: text('unit_size_unit'),
  /** 每个包装内的件数 */
  packCount: integer('pack_count'),
  packDescription: text('pack_description'),
  /** 销售规格或版本 */
  edition: text('edition'),
  /** 混合礼盒/成分不同的套装 */
  isMixedSet: boolean('is_mixed_set').notNull().default(false),
  attrs: jsonb('attrs').$type<Record<string, unknown>>().notNull().default({}),
  notes: text('notes'),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [index('variants_product_idx').on(t.productId), index('variants_barcode_idx').on(t.barcode)])

export const productTags = pgTable('product_tags', {
  productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
  tagId: uuid('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [primaryKey({ columns: [t.productId, t.tagId] })])

/** 商家 / 门店 / 站点，销售市场在这里（≠ 品牌所在地、≠ 产地）。 */
export const merchants = pgTable('merchants', {
  id: id(),
  name: text('name').notNull(),
  storeName: text('store_name'),
  channelType: text('channel_type').notNull().default('other'),
  url: text('url'),
  country: text('country'),
  city: text('city'),
  defaultCurrency: text('default_currency'),
  notes: text('notes'),
  createdAt: createdAt(),
}, (t) => [index('merchants_name_idx').on(t.name)])

/**
 * 价格观察：每次观察新增一条，不覆盖历史。
 * 关键规格与报价条件在记录里留快照（snapshot_*），后续修改商品资料不会改变历史含义。
 */
export const observations = pgTable('observations', {
  id: id(),
  /** 客户端生成的唯一 ID，保证同步幂等 */
  clientId: text('client_id').notNull(),
  status: text('status').notNull().default('draft'), // draft | pending | confirmed | void
  variantId: uuid('variant_id').references(() => variants.id),
  productId: uuid('product_id').references(() => products.id),
  categoryId: uuid('category_id').references(() => categories.id),

  rawName: text('raw_name'),
  rawSpec: text('raw_spec'),
  /** 记录当时的商品/规格关键信息快照 */
  snapshot: jsonb('snapshot').$type<Record<string, any>>().notNull().default({}),
  snapUnitSize: numeric('snap_unit_size', { precision: 14, scale: 4 }),
  snapUnitSizeUnit: text('snap_unit_size_unit'),
  snapPackCount: integer('snap_pack_count'),
  snapIsMixedSet: boolean('snap_is_mixed_set').notNull().default(false),

  merchantId: uuid('merchant_id').references(() => merchants.id),
  merchantNameRaw: text('merchant_name_raw'),
  /** 销售市场（国家/地区），与手机所在地无关 */
  marketCountry: text('market_country'),
  marketCity: text('market_city'),
  channelType: text('channel_type'),

  observedAt: timestamp('observed_at', { withTimezone: true }).notNull(),
  timezone: text('timezone'),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),

  amount: numeric('amount', { precision: 16, scale: 4 }),
  currency: text('currency'),
  quoteUnit: text('quote_unit').notNull().default('item'), // package | item | kg | l
  quoteQty: numeric('quote_qty', { precision: 14, scale: 4 }).notNull().default('1'),
  quotePackDescription: text('quote_pack_description'),
  saleType: text('sale_type').notNull().default('retail'),
  priceType: text('price_type').notNull().default('regular'),
  originalAmount: numeric('original_amount', { precision: 16, scale: 4 }),
  promoCondition: text('promo_condition'),
  promoValidUntil: timestamp('promo_valid_until', { withTimezone: true }),
  taxStatus: text('tax_status').notNull().default('unknown'),
  shippingStatus: text('shipping_status').notNull().default('unknown'),
  shippingAmount: numeric('shipping_amount', { precision: 16, scale: 4 }),
  stockStatus: text('stock_status'),
  minOrderQty: integer('min_order_qty'),
  condition: text('condition'),
  sourceUrl: text('source_url'),
  notes: text('notes'),
  /** 手机端声明的照片数量；实际附件少于此值表示照片未上传完整 */
  expectedPhotos: integer('expected_photos').notNull().default(0),
  /** 随草稿携带的自由标签（关联商品后并入商品标签） */
  tags: jsonb('tags').$type<string[]>().notNull().default([]),

  voidReason: text('void_reason'),
  voidedAt: timestamp('voided_at', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (t) => [
  uniqueIndex('observations_client_id_uq').on(t.clientId),
  index('observations_variant_idx').on(t.variantId),
  index('observations_status_idx').on(t.status),
  index('observations_observed_idx').on(t.observedAt),
])

export const attachments = pgTable('attachments', {
  id: id(),
  clientId: text('client_id').notNull(),
  observationId: uuid('observation_id').references(() => observations.id, { onDelete: 'cascade' }),
  productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().default('other'), // front | back | price_tag | other
  originalName: text('original_name'),
  storedName: text('stored_name').notNull(),
  mime: text('mime').notNull(),
  size: integer('size').notNull(),
  sha256: text('sha256').notNull(),
  createdAt: createdAt(),
}, (t) => [uniqueIndex('attachments_client_id_uq').on(t.clientId), index('attachments_obs_idx').on(t.observationId)])

/** 重要修改的前后值。action: create | correct | relink | status | void | update */
export const auditLog = pgTable('audit_log', {
  id: id(),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  action: text('action').notNull(),
  changes: jsonb('changes').$type<Record<string, { from: unknown; to: unknown }>>().notNull().default({}),
  note: text('note'),
  createdAt: createdAt(),
}, (t) => [index('audit_entity_idx').on(t.entityType, t.entityId)])
