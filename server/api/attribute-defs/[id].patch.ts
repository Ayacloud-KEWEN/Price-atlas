import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const body = z.object({
    label: reqText(40),
    unit: optText(20),
    sortOrder: z.number().int(),
    options: z.array(z.string().trim().min(1).max(40)).max(50).nullable(),
  }).partial().parse(await readBody(event))
  const [row] = await useDb().update(schema.attributeDefs).set(body).where(eq(schema.attributeDefs.id, id)).returning()
  if (!row) throw httpError(404, '属性不存在')
  return row
})
