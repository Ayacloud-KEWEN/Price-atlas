import { eq } from 'drizzle-orm'
import { z } from 'zod'

const { products, productTags } = schema

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const body = parsePartial(productInput.partial(), await readBody(event)) as Record<string, any>
  const db = useDb()
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(products).where(eq(products.id, id)).limit(1)
    if (!before) throw httpError(404, '商品不存在')
    const { tags: tagNames, newBrandName, ...rest } = body
    const set: Record<string, any> = { ...rest }
    if (newBrandName || rest.brandId !== undefined) set.brandId = await resolveBrandId(tx, rest.brandId, newBrandName)
    const changes = diffObjects(before, set, ['categoryId', 'brandId', 'name', 'nameOriginal', 'series', 'attrs', 'customAttrs', 'notes'])
    if (Object.keys(changes).length) {
      set.updatedAt = new Date()
      await tx.update(products).set(set).where(eq(products.id, id))
      // 历史价格记录保留各自的分类/规格快照，不受影响
      await writeAudit(tx, 'product', id, 'update', changes)
    }
    if (tagNames) {
      await tx.delete(productTags).where(eq(productTags.productId, id))
      await attachTags(tx, id, tagNames)
    }
    return { ok: true, changes }
  })
})
