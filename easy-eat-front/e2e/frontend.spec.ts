import AxeBuilder from '@axe-core/playwright'
import { expect, test as base, type Page } from '@playwright/test'

const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('easy-eat-e2e-initialized')) {
        localStorage.removeItem('easy-eat-mock-db-v1')
        sessionStorage.setItem('easy-eat-e2e-initialized', 'true')
      }
    })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await use(page)
    expect(errors, 'No uncaught application errors').toEqual([])
  },
})

async function open(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('main')).toHaveAttribute('aria-busy', 'false')
  await expect(page.locator('main [role="status"]')).toHaveCount(0)
}

test('draft persists, is edited, submitted and completed using visible controls', async ({
  page,
}) => {
  await open(page, '/orders/add')
  await page.getByLabel('餐廳', { exact: true }).selectOption({ label: 'HOT8' })
  await page.getByLabel('餐點名稱 1').selectOption({ label: 'Pizza' })
  await page.getByLabel('數量 1', { exact: true }).fill('2')
  await page.getByLabel('備註 1').fill('少辣')
  await page.getByRole('button', { name: '儲存草稿', exact: true }).click()
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  await expect(page.getByRole('heading', { name: '訂單詳細內容' })).toBeVisible()
  const detailUrl = page.url()
  await expect(page.locator('.status-badge')).toHaveText('草稿')
  await page.reload()
  await expect(page.locator('.status-badge')).toHaveText('草稿')
  await expect(page.locator('tbody')).toContainText('少辣')
  await expect(page.locator('.total-amount')).toHaveText('500 元')
  await page.getByRole('link', { name: '編輯訂單' }).click()
  await page.getByLabel('數量 1', { exact: true }).fill('3')
  await page.getByLabel('備註 1').fill('不要辣')
  await page.getByRole('button', { name: '儲存草稿', exact: true }).click()
  await expect(page).toHaveURL(detailUrl)
  await page.reload()
  await expect(page.locator('tbody')).toContainText('不要辣')
  await expect(page.locator('.total-amount')).toHaveText('750 元')
  await page.getByRole('button', { name: '送出訂單', exact: true }).click()
  await expect(page.locator('.status-badge')).toHaveText('處理中')
  await expect(page.getByRole('button', { name: '取消訂單' })).toBeVisible()
  await page.getByRole('button', { name: '標記完成' }).click()
  await expect(page.locator('.status-badge')).toHaveText('已完成')
  await expect(page.locator('.status-actions')).toHaveCount(0)
  await page.reload()
  await expect(page.locator('.status-badge')).toHaveText('已完成')
  await page.getByRole('link', { name: '所有訂餐清單' }).click()
  await expect(page.locator('tbody tr')).toHaveCount(1)
  await expect(page.locator('tbody')).toContainText('已完成')
})

test('admin-created category, restaurant and meal are orderable', async ({ page }) => {
  await open(page, '/admin')
  await page.getByRole('button', { name: '餐點分類', exact: true }).click()
  await page.getByLabel('分類名稱', { exact: true }).fill('E2E 分類')
  await page.getByRole('button', { name: '新增分類', exact: true }).click()
  await expect(page.locator('.category-row').filter({ hasText: 'E2E 分類' })).toBeVisible()
  await page.getByRole('button', { name: '餐廳與餐點', exact: true }).click()
  await page.getByLabel('餐廳名稱', { exact: true }).fill('E2E 餐廳')
  await page.getByRole('button', { name: '新增餐廳', exact: true }).click()
  const restaurant = page.locator('.restaurant-block').filter({ hasText: 'E2E 餐廳' })
  await expect(restaurant).toBeVisible()
  await restaurant.getByRole('button', { name: '管理餐點', exact: true }).click()
  const panel = restaurant.locator('.menu-panel')
  await panel.getByPlaceholder('餐點名稱', { exact: true }).fill('E2E 套餐')
  await panel.locator('form input[type="number"]').fill('180')
  await panel.locator('form select').selectOption({ label: 'E2E 分類' })
  await panel.getByRole('button', { name: '新增餐點' }).click()
  await expect(panel.locator('tbody tr').filter({ hasText: 'E2E 套餐' })).toContainText('180 元')
  await page.getByRole('link', { name: '新增訂餐', exact: true }).click()
  await page.getByLabel('餐廳', { exact: true }).selectOption({ label: 'E2E 餐廳' })
  await page.getByLabel('餐點名稱 1').selectOption({ label: 'E2E 套餐' })
  await page.getByRole('button', { name: '送出訂單', exact: true }).click()
  await expect(page.locator('.status-badge')).toHaveText('處理中')
  await expect(page.locator('.detail-card')).toContainText('E2E 餐廳')
  await expect(page.locator('tbody')).toContainText('E2E 套餐')
  await expect(page.locator('.total-amount')).toHaveText('180 元')
})

test('a new context starts with default data, not another test data', async ({ page }) => {
  await open(page, '/')
  await expect(page.getByText('目前沒有訂單')).toBeVisible()
  await page.getByRole('link', { name: '後台設定', exact: true }).click()
  await expect(page.locator('.restaurant-block')).toHaveCount(4)
  await expect(page.locator('.restaurant-block').filter({ hasText: 'E2E 餐廳' })).toHaveCount(0)
})

for (const route of ['/', '/orders/add', '/statistics', '/admin', '/route-that-does-not-exist']) {
  test(`accessibility: ${route}`, async ({ page }, testInfo) => {
    await open(page, route)
    const results = await new AxeBuilder({ page }).analyze()
    await testInfo.attach('axe-results', {
      body: JSON.stringify(results, null, 2),
      contentType: 'application/json',
    })
    const violations = results.violations
      .filter(({ impact }) => impact === 'critical' || impact === 'serious')
      .map(({ id, impact, helpUrl, nodes }) => ({
        id,
        impact,
        helpUrl,
        targets: nodes.map(({ target }) => target),
      }))
    expect(violations).toEqual([])
    if (route.includes('does-not-exist')) {
      await expect(page.getByRole('heading', { name: '找不到此頁面' })).toBeVisible()
      await expect(page.locator('.error-code')).toHaveText('404')
    }
  })
}

test('navigation, order controls and admin tabs remain keyboard operable', async ({ page }) => {
  await open(page, '/')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '所有訂餐清單' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: '新增訂餐', exact: true })).toBeFocused()
  await expect(page.getByRole('link', { name: '新增訂餐', exact: true })).toHaveCSS(
    'outline-width',
    '2px',
  )
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/orders\/add$/)
  const restaurant = page.getByLabel('餐廳', { exact: true })
  await restaurant.focus()
  await page.keyboard.press('h')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '新增餐點' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('餐點名稱 1')).toBeFocused()
  await page.keyboard.press('p')
  await page.keyboard.press('Tab')
  await expect(page.getByLabel('數量 1', { exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.type('keyboard note')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: '儲存草稿', exact: true })).toBeFocused()
  await page.keyboard.press('Space')
  await expect(page).toHaveURL(/\/orders\/[^/]+$/)
  await expect(page.locator('tbody')).toContainText('keyboard note')
  await open(page, '/admin')
  const tab = page.getByRole('button', { name: '餐點分類', exact: true })
  await tab.focus()
  await page.keyboard.press('Space')
  await expect(tab).toBeFocused()
  await expect(tab).toHaveAttribute('aria-current', 'page')
  await expect(page.getByLabel('分類名稱', { exact: true })).toBeVisible()
})
