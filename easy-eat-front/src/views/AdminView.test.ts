import { describe, expect, it, vi } from 'vitest'
import { restaurantService } from '@/services/restaurantService'
import { click, renderApp, settle } from '@/test/ui'

describe('Admin CRUD integration', () => {
  it.each([
    { kind: 'restaurant', tab: '餐廳與餐點', prefix: '餐廳', row: '.restaurant-block' },
    { kind: 'category', tab: '餐點分類', prefix: '分類', row: '.category-row' },
  ])(
    'validates and creates, edits, toggles, searches and deletes $kind',
    async ({ kind, tab, prefix, row }) => {
      const { wrapper } = await renderApp('/admin')
      await settle()
      await click(wrapper, tab)
      await wrapper.get('form').trigger('submit')
      expect(wrapper.text()).toContain(`請輸入${prefix}名稱`)
      await wrapper.get(`#new-${kind}-name`).setValue('UI 新資料')
      await wrapper.get('form').trigger('submit')
      expect(wrapper.get('form button').attributes('disabled')).toBeDefined()
      await settle()
      const entry = () => {
        const result = wrapper.findAll(row).find((candidate) => {
          const input = candidate.find<HTMLInputElement>('input')
          return (
            candidate.text().includes('UI 新資料') ||
            (input.exists() && input.element.value.includes('UI 新資料'))
          )
        })
        if (!result) throw new Error('Created row is missing')
        return result
      }
      await click(entry(), '編輯')
      await entry().get('input').setValue('UI 新資料 edited')
      await click(entry(), '儲存')
      await settle()
      expect(entry().text()).toContain('edited')
      await click(entry(), '停用')
      await settle()
      expect(entry().text()).toContain('已停用')
      await click(entry(), '啟用')
      await settle()
      expect(entry().text()).toContain('已啟用')
      await wrapper.get('input[type="search"]').setValue('no-match')
      expect(wrapper.text()).toContain(`找不到符合條件的${prefix}`)
      await wrapper.get('input[type="search"]').setValue('')
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
      await click(entry(), '刪除')
      expect(entry().exists()).toBe(true)
      confirm.mockReturnValue(true)
      await click(entry(), '刪除')
      await settle()
      expect(wrapper.text()).not.toContain('UI 新資料')
    },
  )

  it('failed category creation retains values and shows the real error without success', async () => {
    const { wrapper, toast } = await renderApp('/admin')
    await settle()
    await click(wrapper, '餐點分類')
    vi.spyOn(restaurantService, 'createCategory').mockRejectedValueOnce(new Error('分類服務離線'))
    await wrapper.get('#new-category-name').setValue('保留分類')
    await wrapper.get('form').trigger('submit')
    await settle()
    expect(wrapper.get('#new-category-name').element).toHaveProperty('value', '保留分類')
    expect(wrapper.text()).toContain('分類服務離線')
    expect(toast.toasts.value.at(-1)).toMatchObject({ type: 'error', message: '分類服務離線' })
    expect(toast.toasts.value.some((entry) => entry.type === 'success')).toBe(false)
    expect(wrapper.get('form button').attributes('disabled')).toBeUndefined()
  })

  it('preserves a category referenced by menu items when deletion is rejected', async () => {
    const { wrapper } = await renderApp('/admin')
    await settle()
    await click(wrapper, '餐點分類')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const category = wrapper.findAll('.category-row').find((row) => row.text().includes('食物'))!
    await click(category, '刪除')
    await settle()
    expect(category.text()).toContain('食物')
    expect(category.get('[role="alert"]').text()).toContain('分類')
  })

  it('validates menu fields then creates, edits, disables and deletes a menu item', async () => {
    const { wrapper } = await renderApp('/admin')
    await settle()
    const restaurant = wrapper
      .findAll('.restaurant-block')
      .find((row) => row.text().includes('HOT8'))!
    await click(restaurant, '管理餐點')
    const panel = () => wrapper.get('.menu-panel')
    await panel().get('form').trigger('submit')
    expect(panel().text()).toContain('請輸入餐點名稱')
    expect(panel().text()).toContain('價格必須為大於 0 的整數')
    await panel().get('input[placeholder="餐點名稱"]').setValue('UI 套餐')
    await panel().get('input[type="number"]').setValue(180)
    await panel().get('form').trigger('submit')
    await settle()
    const item = () =>
      panel()
        .findAll('tbody tr')
        .find((row) => {
          const input = row.find<HTMLInputElement>('input[aria-label="餐點名稱"]')
          return (
            row.text().includes('UI 套餐') || (input.exists() && input.element.value === 'UI 套餐')
          )
        })!
    expect(item().text()).toContain('180 元')
    await click(item(), '編輯')
    await item().get('input[aria-label="餐點價格"]').setValue(200)
    await click(item(), '儲存')
    await settle()
    expect(item().text()).toContain('200 元')
    await click(item(), '停用')
    await settle()
    expect(item().text()).toContain('已停用')
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(restaurantService, 'deleteMenuItem').mockRejectedValueOnce(new Error('刪除餐點失敗'))
    await click(item(), '刪除')
    await settle()
    expect(item().text()).toContain('UI 套餐')
    await click(item(), '刪除')
    await settle()
    expect(panel().text()).not.toContain('UI 套餐')
  })

  it('empty admin data gives explicit empty states and disables menu creation without categories', async () => {
    const { wrapper, restaurants } = await renderApp('/admin')
    await settle()
    restaurants.restaurants = []
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('尚未建立任何餐廳')
    await wrapper.get('#new-restaurant-name').setValue('無分類餐廳')
    await wrapper.get('form').trigger('submit')
    await settle()
    restaurants.categories = []
    await click(wrapper, '管理餐點')
    expect(wrapper.text()).toContain('尚無餐點')
    expect(wrapper.text()).toContain('尚無已啟用的餐點分類')
    expect(wrapper.get('.menu-form button').attributes('disabled')).toBeDefined()
    await click(wrapper, '餐點分類')
    expect(wrapper.text()).toContain('尚未建立任何餐點分類')
  })

  it('reset cancellation is a no-op and confirmed reset restores defaults', async () => {
    const { wrapper, restaurants, toast } = await renderApp('/admin')
    await settle()
    await wrapper.get('#new-restaurant-name').setValue('待重置餐廳')
    await wrapper.get('form').trigger('submit')
    await settle()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await click(wrapper, '重置 Mock 資料')
    expect(wrapper.text()).toContain('待重置餐廳')
    confirm.mockReturnValue(true)
    await click(wrapper, '重置 Mock 資料')
    await settle()
    await settle()
    expect(wrapper.text()).not.toContain('待重置餐廳')
    expect(restaurants.restaurants).toHaveLength(4)
    await vi.waitFor(() =>
      expect(toast.toasts.value.at(-1)).toMatchObject({
        type: 'success',
        message: 'Mock 資料已重置',
      }),
    )
  })
})
