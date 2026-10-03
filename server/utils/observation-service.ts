import { eq } from 'drizzle-orm'
import { useDb, schema } from './db'
import {
  buildSnapshot, createProductWithVariant, createVariantFor, resolveMerchantId, uncategorizedId, httpError, attachTags,
  diffObjects, writeAudit, withDerived, photoCounts, type Tx,
} from './observations'

const { observations, variants, merchants } = schema

export function fieldError(fields: Record<string, string>) {
  return createError({ statusCode: 422, statusMessage: '请检查标红的字段', data: { fields } })
}

/** 不同状态的必填校验：草稿几乎不要求，待核查/已确认需要完整价格 */
export function validateForStatus(d: Record<string, any>, status: string, linked: boolean) {
  if (status === 'draft' || status === 'void') return
  const f: Record<string, string> = {}
  if (!linked && !d.rawName) f.rawName = '请填写商品名称，或关联已有商品规格'
  if (d.amount == null || d.amount === '') f.amount = '请填写金额'
  else if (Number(d.amount) <= 0) f.amount = '金额必须大于 0'
  if (!d.currency) f.currency = '请选择币种'
  if (d.quoteUnit === 'package' && d.snapPackCount == null && !linked) f.snapPackCount = '按整包装报价时请填写包装内件数（不确定可改用“每件”）'
  if (d.shippingStatus === 'paid' && d.shippingAmount == null) f.shippingAmount = '另付运费请填写运费金额'
  if (d.priceType === 'promo' && d.originalAmount != null && d.amount != null && Number(d.originalAmount) < Number(d.amount)) {
    f.originalAmount = '原价低于促销价，请核对'
  }
  if (status === 'confirmed' && !d.variantId) f.variantId = '确认前需关联商品规格（草稿/待核查阶段可暂缺）'
  if (Object.keys(f).length) throw fieldError(f)
}

const PRICE_KEYS = [
  'amount', 'currency', 'quoteUnit', 'quoteQty', 'quotePackDescription', 'saleType', 'priceType', 'originalAmount',
  'promoCondition', 'promoValidUntil', 'taxStatus', 'shippingStatus', 'shippingAmount', 'stockStatus', 'minOrderQty',
  'condition', 'sourceUrl', 'notes', 'rawName', 'rawSpec', 'merchantId', 'merchantNameRaw', 'marketCountry', 'marketCity',
  'channelType', 'observedAt', 'timezone', 'variantId', 'productId', 'categoryId', 'status',
  'snapUnitSize', 'snapUnitSizeUnit', 'snapPackCount', 'snapIsMixedSet',
]

const toValues = (d: Record<string, any>) => {
  const v: Record<string, any> = {}
  for (const k of Object.keys(d)) {
    if (['newProduct', 'newVariant', 'newMerchant', 'tags', 'note', 'recordedAt', 'clientId'].includes(k)) continue
    v[k] = d[k]
  }
  if (v.observedAt) v.observedAt = new Date(v.observedAt)
  if (v.promoValidUntil) v.promoValidUntil = new Date(v.promoValidUntil)
  return v
}

export async function createObservation(input: Record<string, any>) {
  const db = useDb()
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(observations).where(eq(observations.clientId, input.clientId)).limit(1)
    if (existing) return { observation: existing, duplicate: true }

    let variantId: string | null = input.variantId ?? null
    let productId: string | null = input.productId ?? null
    if (!variantId && input.newProduct) {
      const created = await createProductWithVariant(tx, input.newProduct)
      variantId = created.variantId; productId = created.productId
    } else if (!variantId && input.newVariant) {
      variantId = await createVariantFor(tx, input.newVariant.productId, input.newVariant.variant)
      productId = input.newVariant.productId
    }
    validateForStatus({ ...input, variantId }, input.status, !!variantId)

    const merchantId = await resolveMerchantId(tx, input.merchantId, input.newMerchant)
    const values = toValues(input)
    Object.assign(values, {
      variantId, productId, merchantId, recordedAt: new Date(input.recordedAt), receivedAt: new Date(),
      clientId: input.clientId, expectedPhotos: input.expectedPhotos ?? 0, tags: input.tags ?? [],
    })
    if (variantId) {
      Object.assign(values, await buildSnapshot(tx, variantId))
    } else if (!values.categoryId) {
      values.categoryId = await uncategorizedId(tx)
    }
    if (merchantId) {
      const [m] = await tx.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1)
      // 门店默认值只在记录未填写时带入，且始终可改
      if (m) {
        values.marketCountry ??= m.country; values.marketCity ??= m.city
        values.channelType ??= m.channelType; values.currency ??= m.defaultCurrency
      }
    }
    const [row] = await tx.insert(observations).values(values as any).onConflictDoNothing({ target: observations.clientId }).returning()
    if (!row) {
      const [again] = await tx.select().from(observations).where(eq(observations.clientId, input.clientId)).limit(1)
      return { observation: again!, duplicate: true }
    }
    if (productId && (input.tags?.length)) await attachTags(tx, productId, input.tags)
    await writeAudit(tx, 'observation', row.id, 'create', {}, input.newProduct ? '同时新建商品与规格' : null)
    return { observation: row, duplicate: false }
  })
}

/** 修正（更正已有记录）与“新增观察”不同：修正会保留前后值。 */
export async function patchObservation(id: string, patch: Record<string, any>) {
  const db = useDb()
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(observations).where(eq(observations.id, id)).limit(1)
    if (!before) throw httpError(404, '记录不存在')
    if (before.status === 'void') throw httpError(409, '已作废的记录不可修改')

    const next: Record<string, any> = toValues(patch)
    let relinked = false
    if (patch.newProduct && !patch.variantId) {
      const created = await createProductWithVariant(tx, patch.newProduct)
      next.variantId = created.variantId; next.productId = created.productId
    } else if (patch.newVariant && !patch.variantId) {
      next.variantId = await createVariantFor(tx, patch.newVariant.productId, patch.newVariant.variant)
      next.productId = patch.newVariant.productId
    }
    if (next.variantId && next.variantId !== before.variantId) {
      relinked = true
      Object.assign(next, await buildSnapshot(tx, next.variantId))
    } else if (patch.variantId === null) {
      next.productId = null
    }
    if (patch.newMerchant && !patch.merchantId) next.merchantId = await resolveMerchantId(tx, null, patch.newMerchant)

    const merged = { ...before, ...next }
    validateForStatus(merged, merged.status, !!merged.variantId)
    delete next.snapshot // 快照只在关联规格时由系统生成
    if (relinked) next.snapshot = (await buildSnapshot(tx, next.variantId)).snapshot

    const keys = [...PRICE_KEYS]
    const changes = diffObjects(before, { ...next }, keys)
    if (!Object.keys(changes).length && !patch.tags) return { observation: before, changes }
    next.updatedAt = new Date()
    const [row] = await tx.update(observations).set(next).where(eq(observations.id, id)).returning()
    if (patch.tags?.length && row!.productId) await attachTags(tx, row!.productId, patch.tags)
    if (Object.keys(changes).length) {
      const action = relinked ? 'relink' : ('status' in changes && Object.keys(changes).length === 1 ? 'status' : 'correct')
      await writeAudit(tx, 'observation', id, action, changes, patch.note)
    }
    return { observation: row!, changes }
  })
}

export async function voidObservation(id: string, reason: string | null) {
  const db = useDb()
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(observations).where(eq(observations.id, id)).limit(1)
    if (!before) throw httpError(404, '记录不存在')
    if (before.status === 'void') return before
    const [row] = await tx.update(observations).set({ status: 'void', voidReason: reason, voidedAt: new Date(), updatedAt: new Date() })
      .where(eq(observations.id, id)).returning()
    await writeAudit(tx, 'observation', id, 'void', { status: { from: before.status, to: 'void' } }, reason)
    return row!
  })
}

export async function presentObservations(rows: (typeof observations.$inferSelect)[]) {
  const db = useDb()
  const counts = await photoCounts(db, rows.map((r) => r.id))
  return rows.map((r) => ({ ...withDerived(r), photoCount: counts.get(r.id) ?? 0 }))
}

export { type Tx, variants }
