import { describe, expect, it } from 'vitest'
import { renderApp, settle } from '@/test/ui'

describe('Router and 404', () => {
  it.each([
    ['/', 'order-list', '所有訂餐清單'],
    ['/orders/add', 'order-add', '新增訂單'],
    ['/orders/missing/edit', 'order-edit', '編輯訂單'],
    ['/orders/missing', 'order-detail', '訂單詳細內容'],
    ['/statistics', 'statistics', '訂單餐點統計表'],
    ['/admin', 'admin', '後台設定'],
    ['/unknown/nested', 'not-found', '找不到此頁面'],
  ])('resolves and renders %s', async (path, name, heading) => {
    const { wrapper, router } = await renderApp(path)
    await settle()
    expect(router.currentRoute.value.name).toBe(name)
    expect(wrapper.get('main h1').text()).toContain(heading)
    if (name === 'order-detail' || name === 'order-edit') {
      expect(router.currentRoute.value.params.id).toBe('missing')
      expect(wrapper.text()).toContain('找不到此訂單')
    }
    if (name === 'not-found') {
      const home = wrapper.get('main a')
      expect(home.attributes('href')).toBe('/')
      await home.trigger('click')
      await settle()
      expect(router.currentRoute.value.name).toBe('order-list')
    }
  })
})
