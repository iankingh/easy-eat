import { createPinia, setActivePinia } from 'pinia'
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import App from '@/App.vue'
import routes from '@/router'
import { useToast } from '@/composables/useToast'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'

enableAutoUnmount(afterEach)

beforeEach(() => {
  vi.useFakeTimers()
  const storage = new Map<string, string>()
  vi.stubGlobal(
    'localStorage',
    window.localStorage ?? {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    },
  )
  localStorage.removeItem('easy-eat-mock-db-v1')
  useToast().toasts.value = []
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.clearAllTimers()
  vi.useRealTimers()
  document.body.innerHTML = ''
})

export async function settle() {
  await flushPromises()
  await vi.advanceTimersByTimeAsync(200)
  await flushPromises()
}

export async function renderApp(path = '/') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = createRouter({ history: createMemoryHistory(), routes: routes.options.routes })
  await router.push(path)
  await router.isReady()
  const wrapper = mount(App, { attachTo: document.body, global: { plugins: [pinia, router] } })
  return {
    wrapper,
    router,
    orders: useOrderStore(pinia),
    restaurants: useRestaurantStore(pinia),
    toast: useToast(),
  }
}

export async function click(wrapper: Pick<VueWrapper, 'findAll'>, text: string) {
  const button = wrapper.findAll('button').find((candidate) => candidate.text() === text)
  if (!button) throw new Error(`Button not found: ${text}`)
  await button.trigger('click')
}

export async function fillOrder(wrapper: VueWrapper) {
  await wrapper.get('#restaurant-select').setValue('r1')
  await wrapper.get('.item-select').setValue('m1')
  await wrapper.get('.qty-input').setValue(2)
  await wrapper.get('.note-input').setValue('少辣')
}
