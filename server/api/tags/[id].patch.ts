import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const { name } = z.object({ name: reqText(40) }).parse(await readBody(event))
  try {
    const [row] = await useDb().update(schema.tags).set({ name }).where(eq(schema.tags.id, id)).returning()
    if (!row) throw httpError(404, '标签不存在')
    return row
  } catch (e: any) {
    if (e?.cause?.code === '23505') throw fieldError({ name: '已存在同名标签' })
    throw e
  }
})
