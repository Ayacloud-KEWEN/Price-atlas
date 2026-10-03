export class ApiError extends Error {
  status: number
  fields: Record<string, string>
  network: boolean
  constructor(message: string, status = 0, fields: Record<string, string> = {}, network = false) {
    super(message)
    this.status = status
    this.fields = fields
    this.network = network
  }
}

/** 统一的 API 调用：规范化错误；401 时提示重新登录（不丢本地草稿） */
export async function api<T = any>(url: string, opts: any = {}): Promise<T> {
  try {
    return (await $fetch(url, { credentials: 'same-origin', ...opts })) as T
  } catch (e: any) {
    const status = e?.response?.status ?? e?.statusCode ?? 0
    const data = e?.data?.data
    const message = e?.data?.statusMessage || e?.data?.message || e?.statusMessage || e?.message || '请求失败'
    if (!status) throw new ApiError('网络不可用或服务器无法连接', 0, {}, true)
    if (status === 401 && import.meta.client && !location.pathname.startsWith('/login')) {
      useSessionState().value = 'expired'
    }
    let fields: Record<string, string> = data?.fields ?? {}
    // zod 校验错误
    const issues = e?.data?.data?.issues ?? e?.data?.issues
    if (issues && Array.isArray(issues)) {
      fields = {}
      for (const i of issues) fields[i.path?.join('.') || '_'] = i.message
    }
    throw new ApiError(status === 400 && Object.keys(fields).length ? '请检查标红的字段' : message, status, fields, false)
  }
}

export const useSessionState = () => useState<'ok' | 'expired'>('session-state', () => 'ok')
