import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: number
  type: ToastType
  message: string
}

const toasts = ref<ToastMessage[]>([])
let nextId = 0

const DURATION_MS = 3000

export function useToast() {
  function show(message: string, type: ToastType = 'info') {
    const id = ++nextId
    toasts.value.push({ id, type, message })
    setTimeout(() => {
      dismiss(id)
    }, DURATION_MS)
  }

  function success(message: string) {
    show(message, 'success')
  }

  function error(message: string) {
    show(message, 'error')
  }

  function info(message: string) {
    show(message, 'info')
  }

  function dismiss(id: number) {
    const index = toasts.value.findIndex((t) => t.id === id)
    if (index !== -1) {
      toasts.value.splice(index, 1)
    }
  }

  return { toasts, show, success, error, info, dismiss }
}
