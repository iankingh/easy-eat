import { test, expect, type APIRequestContext } from '@playwright/test'

declare global {
  interface Window {
    reviewTools: Record<string, { execute(input: unknown): Promise<unknown> }>
  }
}

async function openRound(request: APIRequestContext, prefix: string) {
  const post = async (data: Record<string, unknown>) => {
    const response = await request.post('/api/ordering', {
      headers: { 'x-admin-code': 'e2e-only-admin' },
      data,
    })
    expect(response.ok(), await response.text()).toBeTruthy()
    return response.json()
  }
  const title = `${prefix} ${Date.now()}`
  const { restaurantId } = await post({ action: 'create-restaurant', name: title })
  await post({ action: 'add-menu-item', restaurantId, name: title, price: 120 })
  const { roundId } = await post({
    action: 'create-round',
    restaurantId,
    orderDate: '2099-01-01',
    deadline: '12:00',
  })
  await post({ action: 'toggle-round', roundId })
  const snapshot = await (await request.get(`/api/ordering?roundId=${roundId}`)).json()
  return { title, roundId, menuItemId: snapshot.menu[0].id }
}

test('切換團次載入失敗時不顯示或提交舊團次', async ({ page, request }) => {
  const first = await openRound(request, '舊團次')
  const second = await openRound(request, '新團次')
  await page.goto(`/?round=${first.roundId}`)
  await expect(page.getByLabel(`${first.title} 數量`, { exact: true })).toBeEnabled()
  await page.getByRole('button', { name: '返回訂單列表', exact: true }).click()
  await expect(page.getByRole('heading', { name: '可點餐的訂單', exact: true })).toBeVisible()
  let release!: () => void
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**/api/ordering?roundId=${second.roundId}`, async (route) => {
    await held
    await route.fulfill({ status: 503, json: { error: '測試載入失敗' } })
  })
  await page
    .locator('article')
    .filter({ has: page.getByRole('heading', { name: second.title, exact: true }) })
    .getByRole('button', { name: '進入點餐', exact: true })
    .click()
  await expect(page.getByLabel(`${first.title} 數量`, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '送出訂單', exact: true })).toHaveCount(0)
  release()
  await expect(page.getByRole('alert')).toContainText('測試載入失敗')
  await expect(page.getByLabel(`${first.title} 數量`, { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '送出訂單', exact: true })).toHaveCount(0)
  await page.unrouteAll({ behavior: 'wait' })
  await page.getByRole('button', { name: '重新整理', exact: true }).click()
  await expect(page.getByLabel(`${second.title} 數量`, { exact: true })).toBeEnabled()
})

for (const refreshFails of [false, true]) {
  test(`AI 送單保存可修改收據，重新整理${refreshFails ? '失敗' : '成功'}`, async ({
    page,
    request,
  }) => {
    const round = await openRound(request, refreshFails ? 'AI 連線測試' : 'AI 收據測試')
    await page.addInitScript(() => {
      window.reviewTools = {}
      Object.defineProperty(document, 'modelContext', {
        value: {
          registerTool(tool: { name: string; execute(input: unknown): Promise<unknown> }) {
            window.reviewTools[tool.name] = tool
          },
        },
      })
    })
    await page.goto(`/?round=${round.roundId}`)
    await expect(page.getByLabel(`${round.title} 數量`, { exact: true })).toBeEnabled()
    if (refreshFails) {
      let submitted = false
      await page.route('**/api/ordering*', async (route) => {
        if (route.request().method() === 'POST') submitted = true
        else if (submitted) {
          await route.fulfill({ status: 503, json: { error: '測試重新整理失敗' } })
          return
        }
        await route.continue()
      })
    }
    const result = await page.evaluate(
      (id) =>
        window.reviewTools.submit_lunch_order!.execute({
          name: 'AI 同事',
          account: 'ai-receipt-test',
          note: '飯少',
          items: [{ menuItemId: id, quantity: 2 }],
        }),
      round.menuItemId,
    )
    expect(result).toMatchObject({ status: 'submitted' })
    await expect(page.getByRole('button', { name: '修改上一筆訂單', exact: true })).toBeVisible()
    if (refreshFails)
      await expect(page.getByRole('status').filter({ hasText: '請勿重複送單' })).toBeVisible()
    await page.unrouteAll({ behavior: 'wait' })
    await page.reload()
    await page.getByRole('button', { name: '修改上一筆訂單', exact: true }).click()
    await expect(page.getByLabel(`${round.title} 數量`, { exact: true })).toHaveValue('2')
    await expect(page.getByLabel('備註（選填）')).toHaveValue('飯少')
    await page.getByLabel(`${round.title} 數量`, { exact: true }).fill('1')
    await page.getByRole('button', { name: '送出修改', exact: true }).click()
    await expect(
      page.getByText('訂單已送出，可以在此瀏覽器修改上一筆訂單。', { exact: true }),
    ).toBeVisible()
    const snapshot = await (await request.get(`/api/ordering?roundId=${round.roundId}`)).json()
    expect(snapshot.orderCount).toBe(1)
    expect(snapshot.mealCount).toBe(1)
  })
}

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
