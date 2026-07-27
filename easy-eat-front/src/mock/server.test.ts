import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  listOrders,
  getOrderById,
  createOrder,
  updateOrder,
  submitOrder,
  deleteOrder,
  updateOrderStatus,
  listMealStatistics,
  listRestaurants,
  createRestaurant,
  updateRestaurant,
  deleteRestaurant,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  listCategories,
  createCategory,
  updateCategory,
  setCategoryEnabled,
  deleteCategory,
  setRestaurantEnabled,
  setMenuItemEnabled,
} from '@/mock/server'
import { readDatabase, resetDatabase } from '@/mock/db'

// jsdom does not provide localStorage by default in all versions; polyfill just in case
if (typeof window === 'undefined' || !window.localStorage) {
  const store: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k])
      },
    },
    writable: true,
  })
}

beforeEach(() => {
  resetDatabase()
})

// ─────────────────────────── Orders ───────────────────────────────

describe('listOrders', () => {
  it('returns empty array when no orders exist', async () => {
    const orders = await listOrders()
    expect(orders).toEqual([])
  })
})

describe('createOrder', () => {
  it('creates an order with status pending', async () => {
    const order = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 2, note: '' }],
    })
    expect(order.status).toBe('pending')
    expect(order.restaurantName).toBe('HOT8')
    expect(order.items).toHaveLength(1)
    expect(order.items[0].name).toBe('Pizza')
    expect(order.totalAmount).toBe(500)
  })

  it('throws when restaurantId is empty', async () => {
    await expect(
      createOrder({ restaurantId: '', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] }),
    ).rejects.toThrow('請選擇餐廳')
  })

  it('throws when items array is empty', async () => {
    await expect(createOrder({ restaurantId: 'r1', items: [] })).rejects.toThrow(
      '請至少選擇一項餐點',
    )
  })

  it('throws when restaurant does not exist', async () => {
    await expect(
      createOrder({ restaurantId: 'r999', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] }),
    ).rejects.toThrow('找不到餐廳資料')
  })

  it('throws when menuItem does not exist', async () => {
    await expect(
      createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm999', quantity: 1, note: '' }] }),
    ).rejects.toThrow('找不到餐點資料')
  })

  it('assigns a unique orderId', async () => {
    const o1 = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })
    const o2 = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm2', quantity: 1, note: '' }],
    })
    expect(o1.orderId).not.toBe(o2.orderId)
  })

  it('uses one local calendar timestamp in the visible order id', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 6, 26, 0, 30, 0))
      const orderPromise = createOrder({
        restaurantId: 'r1',
        items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
      })
      await vi.runAllTimersAsync()
      const order = await orderPromise

      expect(order.orderId).toMatch(/^20260726-003000-/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('creates a persistent draft and submits it later', async () => {
    const draft = await createOrder(
      { restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] },
      'draft',
    )
    expect(draft.status).toBe('draft')

    const submitted = await submitOrder(draft.id)
    expect(submitted.status).toBe('pending')
  })

  it('updates draft or pending order contents', async () => {
    const draft = await createOrder(
      { restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] },
      'draft',
    )
    const updated = await updateOrder(draft.id, {
      restaurantId: 'r1',
      items: [{ menuItemId: 'm2', quantity: 2, note: '少冰' }],
    })
    expect(updated.items[0].name).toBe('Cola')
    expect(updated.totalAmount).toBe(90)
  })

  it('rejects duplicate menu items', async () => {
    await expect(
      createOrder({
        restaurantId: 'r1',
        items: [
          { menuItemId: 'm1', quantity: 1, note: '' },
          { menuItemId: 'm1', quantity: 2, note: '' },
        ],
      }),
    ).rejects.toThrow('同一餐點不可重複加入訂單')
  })

  it('rejects fractional quantities that would round to zero', async () => {
    await expect(
      createOrder({
        restaurantId: 'r1',
        items: [{ menuItemId: 'm1', quantity: 0.4, note: '' }],
      }),
    ).rejects.toThrow('數量必須為大於 0 的整數')
  })
})

describe('getOrderById', () => {
  it('returns null for unknown id', async () => {
    const result = await getOrderById('does-not-exist')
    expect(result).toBeNull()
  })

  it('returns order when id exists', async () => {
    const created = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })
    const found = await getOrderById(created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })
})

describe('deleteOrder', () => {
  it('removes the order from the list', async () => {
    const order = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })
    await deleteOrder(order.id)
    const found = await getOrderById(order.id)
    expect(found).toBeNull()
  })

  it('is a no-op for unknown id', async () => {
    await expect(deleteOrder('x-not-exists')).resolves.toBeUndefined()
  })
})

describe('updateOrderStatus', () => {
  it('updates status to completed', async () => {
    const order = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })
    const updated = await updateOrderStatus(order.id, { status: 'completed' })
    expect(updated.status).toBe('completed')
  })

  it('updates status to cancelled', async () => {
    const order = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })
    const updated = await updateOrderStatus(order.id, { status: 'cancelled' })
    expect(updated.status).toBe('cancelled')
  })

  it('throws when order does not exist', async () => {
    await expect(updateOrderStatus('not-real', { status: 'completed' })).rejects.toThrow(
      '找不到訂單資料',
    )
  })

  it('throws for invalid status', async () => {
    const order = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })
    // @ts-expect-error intentional invalid value
    await expect(updateOrderStatus(order.id, { status: 'invalid' })).rejects.toThrow(
      '無效的訂單狀態',
    )
  })

  it('rejects transitions from a completed order', async () => {
    const order = await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })
    await updateOrderStatus(order.id, { status: 'completed' })
    await expect(updateOrderStatus(order.id, { status: 'cancelled' })).rejects.toThrow(
      '不允許此訂單狀態轉換',
    )
  })
})

// ─────────────────────── Statistics ────────────────────────────────

describe('listMealStatistics', () => {
  it('returns empty array when no orders', async () => {
    const stats = await listMealStatistics()
    expect(stats).toEqual([])
  })

  it('aggregates quantities across multiple orders', async () => {
    await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 2, note: '' }] })
    await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 3, note: '' }] })
    const stats = await listMealStatistics()
    const pizza = stats.find((s) => s.name === 'Pizza')
    expect(pizza).toBeDefined()
    expect(pizza!.quantity).toBe(5)
    expect(pizza!.total).toBe(1250)
  })
})

// ─────────────────────── Restaurants ───────────────────────────────

describe('listRestaurants', () => {
  it('returns default restaurants', async () => {
    const restaurants = await listRestaurants()
    expect(restaurants.length).toBeGreaterThan(0)
  })
})

describe('createRestaurant', () => {
  it('creates a restaurant with empty menuItems', async () => {
    const r = await createRestaurant({ name: '新餐廳' })
    expect(r.name).toBe('新餐廳')
    expect(r.menuItems).toEqual([])
  })

  it('throws when name is empty', async () => {
    await expect(createRestaurant({ name: '   ' })).rejects.toThrow('餐廳名稱不可為空')
  })
})

describe('updateRestaurant', () => {
  it('updates the restaurant name', async () => {
    const r = await createRestaurant({ name: '原名' })
    const updated = await updateRestaurant(r.id, { name: '新名' })
    expect(updated.name).toBe('新名')
  })

  it('throws when name is empty', async () => {
    const r = await createRestaurant({ name: '原名' })
    await expect(updateRestaurant(r.id, { name: '' })).rejects.toThrow('餐廳名稱不可為空')
  })

  it('throws when restaurant does not exist', async () => {
    await expect(updateRestaurant('r999', { name: '新名' })).rejects.toThrow('找不到餐廳資料')
  })
})

describe('deleteRestaurant', () => {
  it('removes the restaurant', async () => {
    const r = await createRestaurant({ name: '刪除我' })
    await deleteRestaurant(r.id)
    const list = await listRestaurants()
    expect(list.find((x) => x.id === r.id)).toBeUndefined()
  })

  it('protects restaurants referenced by active orders', async () => {
    await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })

    await expect(deleteRestaurant('r1')).rejects.toThrow('仍有草稿或處理中的訂單')
  })
})

// ────────────────────── Menu Items ─────────────────────────────────

describe('createMenuItem', () => {
  it('adds a menu item to the restaurant', async () => {
    const r = await createRestaurant({ name: '測試' })
    const item = await createMenuItem(r.id, { name: '漢堡', price: 120, categoryId: 'c1' })
    expect(item.name).toBe('漢堡')
    expect(item.price).toBe(120)
    expect(item.categoryId).toBe('c1')
  })

  it('throws when name is empty', async () => {
    const r = await createRestaurant({ name: '測試' })
    await expect(createMenuItem(r.id, { name: '', price: 100, categoryId: 'c1' })).rejects.toThrow(
      '餐點名稱不可為空',
    )
  })

  it('throws when price is zero', async () => {
    const r = await createRestaurant({ name: '測試' })
    await expect(
      createMenuItem(r.id, { name: '漢堡', price: 0, categoryId: 'c1' }),
    ).rejects.toThrow('價格必須為大於 0 的整數')
  })

  it('throws when price is a positive fraction', async () => {
    const r = await createRestaurant({ name: '測試' })
    await expect(
      createMenuItem(r.id, { name: '漢堡', price: 0.4, categoryId: 'c1' }),
    ).rejects.toThrow('價格必須為大於 0 的整數')
  })
})

describe('updateMenuItem', () => {
  it('updates the menu item', async () => {
    const r = await createRestaurant({ name: '測試' })
    const item = await createMenuItem(r.id, { name: '漢堡', price: 120, categoryId: 'c1' })
    const updated = await updateMenuItem(r.id, item.id, {
      name: '雙層漢堡',
      price: 150,
      categoryId: 'c1',
    })
    expect(updated.name).toBe('雙層漢堡')
    expect(updated.price).toBe(150)
  })
})

describe('deleteMenuItem', () => {
  it('removes the menu item from the restaurant', async () => {
    const r = await createRestaurant({ name: '測試' })
    const item = await createMenuItem(r.id, { name: '漢堡', price: 120, categoryId: 'c1' })
    await deleteMenuItem(r.id, item.id)
    const list = await listRestaurants()
    const rest = list.find((x) => x.id === r.id)!
    expect(rest.menuItems.find((m) => m.id === item.id)).toBeUndefined()
  })

  it('protects menu items referenced by active orders', async () => {
    await createOrder({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    })

    await expect(deleteMenuItem('r1', 'm1')).rejects.toThrow('仍在草稿或處理中的訂單')
  })
})

describe('enabled flags', () => {
  it('prevents ordering from a disabled restaurant', async () => {
    await setRestaurantEnabled('r1', false)
    await expect(
      createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] }),
    ).rejects.toThrow('此餐廳目前未啟用')
  })

  it('prevents ordering a disabled menu item', async () => {
    await setMenuItemEnabled('r1', 'm1', false)
    await expect(
      createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] }),
    ).rejects.toThrow('目前未啟用')
  })
})

describe('categories', () => {
  it('supports create, update and enable state changes', async () => {
    const category = await createCategory({ name: '早餐' })
    const renamed = await updateCategory(category.id, { name: '早午餐' })
    const disabled = await setCategoryEnabled(category.id, false)

    expect(renamed.name).toBe('早午餐')
    expect(disabled.enabled).toBe(false)
    expect((await listCategories()).some((item) => item.id === category.id)).toBe(true)
  })

  it('does not delete a category that is still referenced', async () => {
    await expect(deleteCategory('c1')).rejects.toThrow('此分類仍有餐點使用')
  })

  it('deletes an unused category', async () => {
    const category = await createCategory({ name: '季節限定' })
    await deleteCategory(category.id)
    expect((await listCategories()).some((item) => item.id === category.id)).toBe(false)
  })
})

describe('database migration', () => {
  it('migrates legacy category strings and enabled defaults', () => {
    localStorage.setItem(
      'easy-eat-mock-db-v1',
      JSON.stringify({
        seq: { order: 0, restaurant: 1, meal: 1 },
        restaurants: [
          {
            id: 'r1',
            name: '舊餐廳',
            menuItems: [{ id: 'm1', name: '舊餐點', price: 50, category: '食物' }],
          },
        ],
        orders: [],
      }),
    )

    const database = readDatabase()
    expect(database.version).toBe(2)
    expect(database.restaurants[0].enabled).toBe(true)
    expect(database.restaurants[0].menuItems[0].enabled).toBe(true)
    expect(database.restaurants[0].menuItems[0].categoryId).toBe('c1')
  })

  it('preserves an intentionally empty category list', () => {
    localStorage.setItem(
      'easy-eat-mock-db-v1',
      JSON.stringify({
        version: 2,
        seq: { order: 0, restaurant: 0, meal: 0, category: 0 },
        categories: [],
        restaurants: [],
        orders: [],
      }),
    )

    expect(readDatabase().categories).toEqual([])
  })
})
