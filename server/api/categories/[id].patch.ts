import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { TEMPLATES } from '../../../shared/templates'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const body = z.object({
    name: reqText(60),
    parentId: optUuid,
    sortOrder: z.number().int(),
    archived: z.boolean(),
    template: z.preprocess((v) => v || null, z.string().nullable().refine((t) => !t || t in TEMPLATES, '未知模板')),
  }).partial().parse(await readBody(event))
  const db = useDb()
  if (body.parentId) {
    const cats = await loadCategoryMap(db)
    if (cats.descendants(id).includes(body.parentId)) throw httpError(422, '不能把分类移动到它自己的子分类下')
  }
  const [row] = await db.update(schema.categories).set(body).where(eq(schema.categories.id, id)).returning()
  if (!row) throw httpError(404, '分类不存在')
  return row
})
