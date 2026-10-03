import type { NitroErrorHandler } from 'nitropack'

/** 统一错误输出：zod 校验错误转为字段级 422，其余保持 h3 默认语义 */
const handler: NitroErrorHandler = (error, event) => {
  const cause: any = (error as any).cause
  const zod = cause?.name === 'ZodError' ? cause : (error as any).name === 'ZodError' ? error : null
  let statusCode = (error as any).statusCode || 500
  let statusMessage = (error as any).statusMessage || 'Internal Server Error'
  let data: any = (error as any).data

  if (zod) {
    statusCode = 422
    statusMessage = '请检查标红的字段'
    const fields: Record<string, string> = {}
    for (const i of zod.issues ?? []) fields[(i.path ?? []).join('.') || '_'] = i.message
    data = { fields }
  } else if (statusCode >= 500) {
    console.error('[price-atlas] server error:', cause ?? error)
    if (!(error as any).statusMessage || (error as any).statusMessage === 'Internal Server Error') statusMessage = '服务器内部错误'
  }
  setResponseStatus(event, statusCode, statusMessage)
  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return send(event, JSON.stringify({ statusCode, statusMessage, data: data ? { ...data } : undefined }))
}
export default handler
