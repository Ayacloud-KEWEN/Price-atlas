export interface Toast { id: number; kind: 'info' | 'success' | 'error'; text: string }
let seq = 0

export function useToast() {
  const toasts = useState<Toast[]>('toasts', () => [])
  const push = (kind: Toast['kind'], text: string, ms = 4500) => {
    const id = ++seq
    toasts.value = [...toasts.value, { id, kind, text }]
    if (ms > 0) setTimeout(() => dismiss(id), ms)
  }
  const dismiss = (id: number) => { toasts.value = toasts.value.filter((t) => t.id !== id) }
  return {
    toasts, dismiss,
    info: (t: string) => push('info', t),
    success: (t: string) => push('success', t),
    error: (t: string) => push('error', t, 8000),
  }
}
