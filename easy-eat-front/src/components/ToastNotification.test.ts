import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import ToastNotification from '@/components/ToastNotification.vue'
import { useToast } from '@/composables/useToast'
import { settle } from '@/test/ui'

describe('ToastNotification', () => {
  it('renders success, error and info alerts in the document, dismissing only the selected toast', async () => {
    mount(ToastNotification)
    const toast = useToast()
    toast.success('已儲存')
    toast.error('儲存失敗')
    toast.info('提示')
    await settle()
    expect(
      [...document.querySelectorAll('.toast-message')].map((node) => node.textContent),
    ).toEqual(['已儲存', '儲存失敗', '提示'])
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(3)
    document.querySelector<HTMLButtonElement>('.toast--error button')?.click()
    await settle()
    expect(document.querySelector('.toast--error')).toBeNull()
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(3000)
    expect(document.querySelectorAll('[role="alert"]')).toHaveLength(0)
  })

  it('dismiss is idempotent and an earlier timeout does not remove a newer notification', async () => {
    mount(ToastNotification)
    const toast = useToast()
    toast.info('first')
    const first = toast.toasts.value[0]!
    toast.dismiss(first.id)
    toast.dismiss(first.id)
    await vi.advanceTimersByTimeAsync(1000)
    toast.success('second')
    await vi.advanceTimersByTimeAsync(2000)
    expect(toast.toasts.value.map((entry) => entry.message)).toEqual(['second'])
    await vi.advanceTimersByTimeAsync(1000)
    expect(toast.toasts.value).toEqual([])
  })
})
