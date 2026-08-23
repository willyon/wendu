import { reactive } from 'vue'

const toasts = reactive([])
let seq = 0

/**
 * 轻量全局消息（风格接近 Element Plus Message，不引入 EP）
 * @param {{ type?: 'success'|'error'|'warning'|'info', message: string, duration?: number }} opts
 */
export function toast({ type = 'info', message, duration = 3200 }) {
  const text = typeof message === 'string' ? message.trim() : ''
  if (!text) return
  const id = ++seq
  toasts.push({ id, type, message: text })
  if (duration > 0) {
    window.setTimeout(() => dismissToast(id), duration)
  }
}

export function toastError(message, duration) {
  toast({ type: 'error', message, duration })
}

export function toastSuccess(message, duration) {
  toast({ type: 'success', message, duration })
}

export function dismissToast(id) {
  const i = toasts.findIndex((item) => item.id === id)
  if (i >= 0) toasts.splice(i, 1)
}

export function useToastState() {
  return { toasts, dismissToast }
}
