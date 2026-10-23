import { test, expect } from '@playwright/test'

test('餐廳與菜單獨立保存，新增餐廳後可繼續新增餐點', async ({ page }) => {
  await page.goto('/?view=admin&manage=restaurants')
  await page.getByLabel('管理碼', { exact: true }).fill('e2e-only-admin')
  await page.getByRole('button', { name: '登入管理後台', exact: true }).click()
  await page.getByLabel('餐廳名稱', { exact: true }).fill(`E2E 餐廳 ${Date.now()}`)
  await page.getByRole('button', { name: '新增餐廳', exact: true }).click()
  await expect(page.getByRole('button', { name: '新增餐點', exact: true })).toBeEnabled()
  await page.getByLabel('餐點名稱', { exact: true }).fill('測試雞腿餐')
  await page.getByLabel('價格', { exact: true }).fill('120')
  await page.getByRole('button', { name: '新增餐點', exact: true }).click()
  await expect(page.getByText('餐點已加入這家餐廳的菜單。', { exact: true })).toBeVisible()
  await expect(page.getByText(/測試雞腿餐/)).toBeVisible()
})

test('同事可下單及修改，後台保有彙總與確認狀態', async ({ page, request }) => {
  const post = async (body: Record<string, unknown>) => {
    const res = await request.post('/api/ordering', {
      headers: { 'x-admin-code': 'e2e-only-admin' },
      data: body,
    })
    expect(res.ok(), await res.text()).toBeTruthy()
    return res.json()
  }
  const title = `E2E 便當 ${Date.now()}`
  const { restaurantId } = await post({ action: 'create-restaurant', name: title })
  await post({
    action: 'add-menu-item',
    restaurantId,
    name: '雞腿餐',
    description: '附湯',
    price: 120,
  })
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(
    new Date(Date.now() + 86400000),
  )
  const { roundId } = await post({
    action: 'create-round',
    restaurantId,
    orderDate: date,
    deadline: '23:59',
  })
  await post({ action: 'update-round', roundId, title, deadline: '23:59', openAfterSave: true })
  await page.goto(`/?round=${roundId}`)
  await page.getByLabel('雞腿餐 數量', { exact: true }).fill('2')
  await page.getByLabel('姓名', { exact: true }).fill('測試同事')
  await page.getByLabel('帳號', { exact: true }).fill('browser-test')
  await page.getByRole('button', { name: '送出訂單', exact: true }).click()
  await expect(
    page.getByText('訂單已送出，可以在此瀏覽器修改上一筆訂單。', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '修改上一筆訂單', exact: true }).click()
  await page.getByLabel('雞腿餐 數量', { exact: true }).fill('1')
  await page.getByRole('button', { name: '送出修改', exact: true }).click()
  await expect(
    page.getByText('訂單已送出，可以在此瀏覽器修改上一筆訂單。', { exact: true }),
  ).toBeVisible()
  await page.goto(`/?view=admin&round=${roundId}`)
  await page.getByLabel('管理碼', { exact: true }).fill('e2e-only-admin')
  await page.getByRole('button', { name: '登入管理後台', exact: true }).click()
  await expect(page.getByRole('heading', { name: '店家出餐彙總', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '未確認', exact: true }).click()
  await expect(page.getByRole('button', { name: '已確認', exact: true })).toBeVisible()
  const result = await request.get(`/api/ordering?roundId=${roundId}`)
  expect((await result.json()).orders).toEqual([])
})
