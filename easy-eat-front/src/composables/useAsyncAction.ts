import { ref, type Ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { getErrorMessage } from '@/utils/error'

interface RunOptions {
  successMessage?: string
  errorMessage?: string
}

export function useAsyncAction(): {
  readonly loading: Ref<boolean>
  run<T>(action: () => Promise<T>, options?: RunOptions): Promise<T | undefined>
} {
  const loading = ref(false)

  async function run<T>(action: () => Promise<T>, options?: RunOptions): Promise<T | undefined> {
    loading.value = true
    try {
      const result = await action()
      if (options?.successMessage) {
        const toast = useToast()
        toast.success(options.successMessage)
      }
      return result
    } catch (error) {
      const toast = useToast()
      toast.error(getErrorMessage(error, options?.errorMessage))
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, run }
}
