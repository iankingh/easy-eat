import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAsyncAction } from '@/composables/useAsyncAction'

const mockSuccess = vi.fn()
const mockError = vi.fn()

vi.mock('@/composables/useToast', () => ({
  useToast: () => ({
    success: mockSuccess,
    error: mockError,
    show: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
    toasts: { value: [] },
  }),
}))

vi.mock('@/utils/error', () => ({
  getErrorMessage: vi.fn((error: unknown, fallback = '發生未知錯誤，請稍後再試') =>
    error instanceof Error ? error.message : fallback,
  ),
}))

describe('useAsyncAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('loading lifecycle', () => {
    it('is false initially', () => {
      const { loading } = useAsyncAction()
      expect(loading.value).toBe(false)
    })

    it('is true during action execution and false after resolve', async () => {
      const { loading, run } = useAsyncAction()
      let resolveAction: (value: string) => void
      const actionPromise = new Promise<string>((resolve) => {
        resolveAction = resolve
      })

      const runPromise = run(() => actionPromise)
      expect(loading.value).toBe(true)

      resolveAction!('result')
      await runPromise
      expect(loading.value).toBe(false)
    })

    it('is false after action rejects', async () => {
      const { loading, run } = useAsyncAction()
      await run(() => Promise.reject(new Error('fail')))
      expect(loading.value).toBe(false)
    })
  })

  describe('successful action with success message', () => {
    it('calls toast.success and returns the result', async () => {
      const { run } = useAsyncAction()
      const result = await run(() => Promise.resolve('data'), {
        successMessage: '已儲存',
      })

      expect(mockSuccess).toHaveBeenCalledWith('已儲存')
      expect(result).toBe('data')
    })
  })

  describe('successful action without success message', () => {
    it('does not call toast.success and returns the result', async () => {
      const { run } = useAsyncAction()
      const result = await run(() => Promise.resolve(42))

      expect(mockSuccess).not.toHaveBeenCalled()
      expect(result).toBe(42)
    })
  })

  describe('failed action with error message', () => {
    it('calls toast.error with derived message and returns undefined', async () => {
      const { run } = useAsyncAction()
      const result = await run(() => Promise.reject(new Error('bad request')), {
        errorMessage: '操作失敗',
      })

      expect(mockError).toHaveBeenCalledWith('bad request')
      expect(result).toBeUndefined()
    })

    it('uses fallback message for non-Error rejections', async () => {
      const { run } = useAsyncAction()
      const result = await run(() => Promise.reject('string error'), {
        errorMessage: '操作失敗',
      })

      expect(mockError).toHaveBeenCalledWith('操作失敗')
      expect(result).toBeUndefined()
    })
  })

  describe('failed action without error message', () => {
    it('calls toast.error with default fallback and returns undefined', async () => {
      const { run } = useAsyncAction()
      const result = await run(() => Promise.reject('oops'))

      expect(mockError).toHaveBeenCalledWith('發生未知錯誤，請稍後再試')
      expect(result).toBeUndefined()
    })
  })

  describe('error re-throw', () => {
    it('does not re-throw the error', async () => {
      const { run } = useAsyncAction()
      await expect(run(() => Promise.reject(new Error('boom')))).resolves.toBeUndefined()
    })
  })
})
