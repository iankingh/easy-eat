import { describe, expect, it, vi } from 'vitest'
import { orderService } from '@/services/orderService'
import { restaurantService } from '@/services/restaurantService'
import { renderApp, settle } from '@/test/ui'

describe('App initialization', () => {
  it('announces loading and defers routed content until both stores finish', async () => {
    const { wrapper } = await renderApp()
    expect(wrapper.get('main').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('[role="status"]').attributes('aria-label')).toBe('應用程式資料載入中')
    expect(wrapper.text()).not.toContain('目前沒有訂單')
    await settle()
    expect(wrapper.get('main').attributes('aria-busy')).toBe('false')
    expect(wrapper.text()).toContain('目前沒有訂單')
    expect(wrapper.find('[role="status"]').exists()).toBe(false)
  })

  it.each(['orders', 'restaurants'] as const)(
    'renders %s startup failure without leaving the application loading',
    async (source) => {
      const failure = new Error('資料服務離線')
      if (source === 'orders') vi.spyOn(orderService, 'getOrders').mockRejectedValue(failure)
      else vi.spyOn(restaurantService, 'getRestaurants').mockRejectedValue(failure)
      const { wrapper } = await renderApp()
      await settle()
      expect(wrapper.get('main').attributes('aria-busy')).toBe('false')
      expect(wrapper.get('.app-status-error').text()).toBe(failure.message)
      expect(document.querySelector('.toast--success')).toBeNull()
    },
  )
})
