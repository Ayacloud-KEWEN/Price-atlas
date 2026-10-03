import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  await useDb().delete(schema.tags).where(eq(schema.tags.id, id))
  return { ok: true }
})
