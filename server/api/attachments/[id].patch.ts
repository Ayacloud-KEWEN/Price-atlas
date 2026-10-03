import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const { kind } = z.object({ kind: z.enum(['front', 'back', 'price_tag', 'other']) }).parse(await readBody(event))
  const [row] = await useDb().update(schema.attachments).set({ kind }).where(eq(schema.attachments.id, id)).returning()
  if (!row) throw httpError(404, '照片不存在')
  return { ok: true }
})
