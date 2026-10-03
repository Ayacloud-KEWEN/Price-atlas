import { eq } from 'drizzle-orm'

const { variants } = schema

/** 修改规格资料（不会改变既有价格记录里的规格快照） */
export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const body = variantInput.parse(await readBody(event))
  const db = useDb()
  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(variants).where(eq(variants.id, id)).limit(1)
    if (!before) throw httpError(404, '规格不存在')
    const changes = diffObjects(before, body, ['label', 'barcode', 'unitSize', 'unitSizeUnit', 'packCount', 'packDescription', 'edition', 'isMixedSet', 'attrs', 'notes'])
    if (Object.keys(changes).length) {
      await tx.update(variants).set({ ...body, updatedAt: new Date() }).where(eq(variants.id, id))
      await writeAudit(tx, 'variant', id, 'update', changes)
    }
    return { ok: true, changes }
  })
})
