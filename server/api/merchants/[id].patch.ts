import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const body = parsePartial(merchantInput.partial(), await readBody(event))
  const [row] = await useDb().update(schema.merchants).set(body).where(eq(schema.merchants.id, id)).returning()
  if (!row) throw httpError(404, '商家不存在')
  return row
})
