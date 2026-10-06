import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import AdminView from '@/views/AdminView.vue'
import MealStatisticsView from '@/views/MealStatisticsView.vue'
import OrderEditView from '@/views/OrderEditView.vue'
import { orderService } from '@/services/orderService'
import routes from '@/router'
import { createMemoryHistory, createRouter } from 'vue-router'
import { settle } from '@/test/ui'

describe('Accessible loading feedback', () => {
  it('uses one custom status name', () => {
    const wrapper = mount(LoadingSpinner, { props: { label: '餐點載入中' } })
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('餐點載入中')
    expect(wrapper.findAll('[role="status"]')).toHaveLength(1)
  })

  it.each([
    { component: AdminView, path: '/admin', label: '後台資料載入中' },
    { component: MealStatisticsView, path: '/statistics', label: '統計資料載入中' },
    { component: OrderEditView, path: '/orders/missing/edit', label: '訂單載入中' },
  ])('$label clears busy after success or failure', async ({ component, path, label }) => {
    const router = createRouter({ history: createMemoryHistory(), routes: routes.options.routes })
    await router.push(path)
    const wrapper = mount(component, { global: { plugins: [createPinia(), router] } })
    await wrapper.vm.$nextTick()
    expect(wrapper.get('section').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe(label)
    await settle()
    expect(wrapper.get('section').attributes('aria-busy')).toBe('false')
    wrapper.unmount()

    vi.spyOn(orderService, 'getOrders').mockRejectedValue(new Error('讀取失敗'))
    const failed = mount(component, { global: { plugins: [createPinia(), router] } })
    await settle()
    expect(failed.get('section').attributes('aria-busy')).toBe('false')
    expect(document.querySelector('.toast--success')).toBeNull()
  })
})
