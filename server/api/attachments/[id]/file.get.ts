import { eq } from 'drizzle-orm'

// 照片只通过鉴权的 API 提供（中间件已校验登录），上传目录不对外公开
export default defineEventHandler(async (event) => {
  const id = uuid.parse(getRouterParam(event, 'id'))
  const [row] = await useDb().select().from(schema.attachments).where(eq(schema.attachments.id, id)).limit(1)
  if (!row) throw httpError(404, '照片不存在')
  setHeader(event, 'Content-Type', row.mime)
  setHeader(event, 'Content-Length', row.size)
  setHeader(event, 'Cache-Control', 'private, max-age=86400')
  setHeader(event, 'X-Content-Type-Options', 'nosniff')
  setHeader(event, 'Content-Disposition', 'inline')
  return sendStream(event, openStored(row.storedName))
})
