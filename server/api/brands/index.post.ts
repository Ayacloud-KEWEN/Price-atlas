import { z } from 'zod'

export default defineEventHandler(async (event) => {
  const body = z.object({ name: reqText(120), nameOriginal: optText(120), country: optText(60), notes: optText(500) }).parse(await readBody(event))
  try {
    const [row] = await useDb().insert(schema.brands).values(body).returning()
    return row
  } catch (e: any) {
    if (e?.cause?.code === '23505') throw fieldError({ name: '已存在同名品牌' })
    throw e
  }
})
