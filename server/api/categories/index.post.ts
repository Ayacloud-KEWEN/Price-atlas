import { z } from 'zod'
import { TEMPLATES } from '../../../shared/templates'

export default defineEventHandler(async (event) => {
  const body = z.object({
    name: reqText(60),
    parentId: optUuid,
    template: z.preprocess((v) => v || null, z.string().nullable().refine((t) => !t || t in TEMPLATES, '未知模板')),
  }).parse(await readBody(event))
  const db = useDb()
  const [row] = await db.insert(schema.categories).values({ name: body.name, parentId: body.parentId, template: body.template }).returning()
  return row
})
