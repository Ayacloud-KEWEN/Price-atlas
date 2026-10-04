import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

const { observations, products } = schema

/** 批量操作：修改分类、添加标签、设置状态。返回明确的逐项结果，便于前端反馈。 */
export default defineEventHandler(async (event) => {
  const body = z.discriminatedUnion('action', [
    z.object({ action: z.literal('setCategory'), ids: z.array(uuid).min(1).max(200), categoryId: uuid }),
    z.object({ action: z.literal('addTag'), ids: z.array(uuid).min(1).max(200), tag: reqText(40) }),
    z.object({ action: z.literal('setStatus'), ids: z.array(uuid).min(1).max(200), status: z.enum(['pending', 'confirmed']) }),
    // 一键：把所有“待核查”记录核查通过；不满足确认条件（如未关联规格）的会被跳过并给出原因
    z.object({ action: z.literal('confirmAllPending') }),
  ]).parse(await readBody(event))
  const db = useDb()
  const result = { updated: 0, skipped: [] as { id: string; name: string | null; reason: string }[], productsUpdated: 0 }

  await db.transaction(async (tx) => {
    const rows = body.action === 'confirmAllPending'
      ? await tx.select().from(observations).where(eq(observations.status, 'pending'))
      : await tx.select().from(observations).where(inArray(observations.id, body.ids))
    for (const r of rows) {
      if (r.status === 'void') { result.skipped.push({ id: r.id, name: r.rawName, reason: '已作废' }); continue }
      if (body.action === 'setCategory') {
        await tx.update(observations).set({ categoryId: body.categoryId, updatedAt: new Date() }).where(eq(observations.id, r.id))
        await writeAudit(tx, 'observation', r.id, 'correct', { categoryId: { from: r.categoryId, to: body.categoryId } }, '批量改分类')
        if (r.productId) {
          const [p] = await tx.select().from(products).where(eq(products.id, r.productId)).limit(1)
          if (p && p.categoryId !== body.categoryId) {
            await tx.update(products).set({ categoryId: body.categoryId, updatedAt: new Date() }).where(eq(products.id, p.id))
            await writeAudit(tx, 'product', p.id, 'update', { categoryId: { from: p.categoryId, to: body.categoryId } }, '批量改分类')
            result.productsUpdated++
          }
        }
        result.updated++
      } else if (body.action === 'addTag') {
        const next = [...new Set([...(r.tags ?? []), body.tag])]
        await tx.update(observations).set({ tags: next, updatedAt: new Date() }).where(eq(observations.id, r.id))
        if (r.productId) await attachTags(tx, r.productId, [body.tag])
        result.updated++
      } else {
        const target = body.action === 'confirmAllPending' ? 'confirmed' : body.status
        try {
          const patch = { status: target }
          // 复用单条校验逻辑
          const merged = { ...r, ...patch }
          validateForStatus(merged, merged.status, !!merged.variantId)
          await tx.update(observations).set({ status: target, updatedAt: new Date() }).where(eq(observations.id, r.id))
          await writeAudit(tx, 'observation', r.id, 'status', { status: { from: r.status, to: target } }, body.action === 'confirmAllPending' ? '一键全部核查通过' : null)
          result.updated++
        } catch (e: any) {
          result.skipped.push({ id: r.id, name: r.rawName, reason: Object.values(e?.data?.fields ?? {}).join('；') || e?.statusMessage || '校验未通过' })
        }
      }
    }
  })
  return result
})
