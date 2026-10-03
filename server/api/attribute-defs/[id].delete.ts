import { eq } from 'drizzle-orm'

// 删除定义不会删除已保存在商品里的值（仍保留在 attrs 中）
export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  await useDb().delete(schema.attributeDefs).where(eq(schema.attributeDefs.id, id))
  return { ok: true }
})
