import { eq } from 'drizzle-orm'
import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const body = z.object({ name: reqText(120), nameOriginal: optText(120), country: optText(60), notes: optText(500) }).partial().parse(await readBody(event))
  try {
    const [row] = await useDb().update(schema.brands).set(body).where(eq(schema.brands.id, id)).returning()
    if (!row) throw httpError(404, '品牌不存在')
    return row
  } catch (e: any) {
    if (e?.cause?.code === '23505') throw fieldError({ name: '已存在同名品牌' })
    throw e
  }
})
