import { describe, it, expect, beforeEach } from 'vitest'
import {
  listOrders,
  getOrderById,
  createOrder,
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
} from '@/mock/server'
import { resetDatabase } from '@/mock/db'

// jsdom does not provide localStorage by default in all versions; polyfill just in case
if (typeof window === 'undefined' || !window.localStorage) {
  const store: Record<string, string> = {}
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]) },
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
    const order = await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 2, note: '' }] })
    expect(order.status).toBe('pending')
    expect(order.restaurantName).toBe('HOT8')
    expect(order.items).toHaveLength(1)
    expect(order.items[0].name).toBe('Pizza')
    expect(order.totalAmount).toBe(500)
  })

  it('throws when restaurantId is empty', async () => {
    await expect(createOrder({ restaurantId: '', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] })).rejects.toThrow('請選擇餐廳')
  })

  it('throws when items array is empty', async () => {
    await expect(createOrder({ restaurantId: 'r1', items: [] })).rejects.toThrow('請至少選擇一項餐點')
  })

  it('throws when restaurant does not exist', async () => {
    await expect(createOrder({ restaurantId: 'r999', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] })).rejects.toThrow('找不到餐廳資料')
  })

  it('throws when menuItem does not exist', async () => {
    await expect(createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm999', quantity: 1, note: '' }] })).rejects.toThrow('找不到餐點資料')
  })

  it('assigns a unique orderId', async () => {
    const o1 = await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] })
    const o2 = await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm2', quantity: 1, note: '' }] })
    expect(o1.orderId).not.toBe(o2.orderId)
  })
})

describe('getOrderById', () => {
  it('returns null for unknown id', async () => {
    const result = await getOrderById('does-not-exist')
    expect(result).toBeNull()
  })

  it('returns order when id exists', async () => {
    const created = await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] })
    const found = await getOrderById(created.id)
    expect(found).not.toBeNull()
    expect(found!.id).toBe(created.id)
  })
})

describe('deleteOrder', () => {
  it('removes the order from the list', async () => {
    const order = await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] })
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
    const order = await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] })
    const updated = await updateOrderStatus(order.id, { status: 'completed' })
    expect(updated.status).toBe('completed')
  })

  it('updates status to cancelled', async () => {
    const order = await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] })
    const updated = await updateOrderStatus(order.id, { status: 'cancelled' })
    expect(updated.status).toBe('cancelled')
  })

  it('throws when order does not exist', async () => {
    await expect(updateOrderStatus('not-real', { status: 'completed' })).rejects.toThrow('找不到訂單資料')
  })

  it('throws for invalid status', async () => {
    const order = await createOrder({ restaurantId: 'r1', items: [{ menuItemId: 'm1', quantity: 1, note: '' }] })
    // @ts-expect-error intentional invalid value
    await expect(updateOrderStatus(order.id, { status: 'invalid' })).rejects.toThrow('無效的訂單狀態')
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
})

// ────────────────────── Menu Items ─────────────────────────────────

describe('createMenuItem', () => {
  it('adds a menu item to the restaurant', async () => {
    const r = await createRestaurant({ name: '測試' })
    const item = await createMenuItem(r.id, { name: '漢堡', price: 120, category: '食物' })
    expect(item.name).toBe('漢堡')
    expect(item.price).toBe(120)
    expect(item.category).toBe('食物')
  })

  it('throws when name is empty', async () => {
    const r = await createRestaurant({ name: '測試' })
    await expect(createMenuItem(r.id, { name: '', price: 100, category: '食物' })).rejects.toThrow('餐點名稱不可為空')
  })

  it('throws when price is zero', async () => {
    const r = await createRestaurant({ name: '測試' })
    await expect(createMenuItem(r.id, { name: '漢堡', price: 0, category: '食物' })).rejects.toThrow('價格必須為大於 0 的數字')
  })
})

describe('updateMenuItem', () => {
  it('updates the menu item', async () => {
    const r = await createRestaurant({ name: '測試' })
    const item = await createMenuItem(r.id, { name: '漢堡', price: 120, category: '食物' })
    const updated = await updateMenuItem(r.id, item.id, { name: '雙層漢堡', price: 150, category: '食物' })
    expect(updated.name).toBe('雙層漢堡')
    expect(updated.price).toBe(150)
  })
})

describe('deleteMenuItem', () => {
  it('removes the menu item from the restaurant', async () => {
    const r = await createRestaurant({ name: '測試' })
    const item = await createMenuItem(r.id, { name: '漢堡', price: 120, category: '食物' })
    await deleteMenuItem(r.id, item.id)
    const list = await listRestaurants()
    const rest = list.find((x) => x.id === r.id)!
    expect(rest.menuItems.find((m) => m.id === item.id)).toBeUndefined()
  })
})
