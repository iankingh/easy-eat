import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CreateOrderInput, MealStatistic, Order, OrderItem } from '@/types/order'

// ── mock orderApi ──────────────────────────────────────────────────
vi.mock('@/api/orderApi', () => ({
  orderApi: {
    list: vi.fn(),
    detail: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    submit: vi.fn(),
    remove: vi.fn(),
    updateStatus: vi.fn(),
    statistics: vi.fn(),
  },
}))

import { orderApi } from '@/api/orderApi'
import { orderService } from '@/services/orderService'

// ── helpers ────────────────────────────────────────────────────────
function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    orderId: '20260623-120000-00001',
    restaurantId: 'r1',
    restaurantName: 'HOT8',
    items: [{ menuItemId: 'm1', name: 'Pizza', price: 250, quantity: 2, note: '' }],
    totalAmount: 500,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    menuItemId: 'm1',
    name: 'Pizza',
    price: 250,
    quantity: 2,
    note: '',
    ...overrides,
  }
}

// ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
})

describe('orderService – getOrders', () => {
  it('calls orderApi.list() and returns the result', async () => {
    const orders: Order[] = [makeOrder({ id: 'o1' }), makeOrder({ id: 'o2' })]
    vi.mocked(orderApi.list).mockResolvedValue(orders)

    const result = await orderService.getOrders()

    expect(orderApi.list).toHaveBeenCalledTimes(1)
    expect(orderApi.list).toHaveBeenCalledWith()
    expect(result).toBe(orders)
  })
})

describe('orderService – getOrderById', () => {
  it('calls orderApi.detail(id) and returns the result', async () => {
    const order = makeOrder({ id: 'o99' })
    vi.mocked(orderApi.detail).mockResolvedValue(order)

    const result = await orderService.getOrderById('o99')

    expect(orderApi.detail).toHaveBeenCalledTimes(1)
    expect(orderApi.detail).toHaveBeenCalledWith('o99')
    expect(result).toBe(order)
  })

  it('returns null when the order does not exist', async () => {
    vi.mocked(orderApi.detail).mockResolvedValue(null)

    const result = await orderService.getOrderById('missing')

    expect(orderApi.detail).toHaveBeenCalledWith('missing')
    expect(result).toBeNull()
  })
})

describe('orderService – createOrder', () => {
  const payload: CreateOrderInput = {
    restaurantId: 'r1',
    items: [{ menuItemId: 'm1', quantity: 2, note: 'extra cheese' }],
  }

  it('defaults status to "pending" when not provided', async () => {
    const created = makeOrder({ id: 'new1', status: 'pending' })
    vi.mocked(orderApi.create).mockResolvedValue(created)

    const result = await orderService.createOrder(payload)

    expect(orderApi.create).toHaveBeenCalledTimes(1)
    expect(orderApi.create).toHaveBeenCalledWith(payload, 'pending')
    expect(result).toBe(created)
  })

  it('forwards an explicit status', async () => {
    const created = makeOrder({ id: 'draft-1', status: 'draft' })
    vi.mocked(orderApi.create).mockResolvedValue(created)

    const result = await orderService.createOrder(payload, 'draft')

    expect(orderApi.create).toHaveBeenCalledWith(payload, 'draft')
    expect(result).toBe(created)
  })
})

describe('orderService – updateOrder', () => {
  it('calls orderApi.update(id, payload) and returns the result', async () => {
    const payload: CreateOrderInput = {
      restaurantId: 'r1',
      items: [{ menuItemId: 'm2', quantity: 1, note: '' }],
    }
    const updated = makeOrder({
      id: 'o1',
      items: [{ menuItemId: 'm2', name: 'Burger', price: 120, quantity: 1, note: '' }],
    })
    vi.mocked(orderApi.update).mockResolvedValue(updated)

    const result = await orderService.updateOrder('o1', payload)

    expect(orderApi.update).toHaveBeenCalledTimes(1)
    expect(orderApi.update).toHaveBeenCalledWith('o1', payload)
    expect(result).toBe(updated)
  })
})

describe('orderService – submitOrder', () => {
  it('calls orderApi.submit(id) and returns the result', async () => {
    const submitted = makeOrder({ id: 'o1', status: 'pending' })
    vi.mocked(orderApi.submit).mockResolvedValue(submitted)

    const result = await orderService.submitOrder('o1')

    expect(orderApi.submit).toHaveBeenCalledTimes(1)
    expect(orderApi.submit).toHaveBeenCalledWith('o1')
    expect(result).toBe(submitted)
  })
})

describe('orderService – deleteOrder', () => {
  it('calls orderApi.remove(id)', async () => {
    vi.mocked(orderApi.remove).mockResolvedValue(undefined)

    const result = await orderService.deleteOrder('o1')

    expect(orderApi.remove).toHaveBeenCalledTimes(1)
    expect(orderApi.remove).toHaveBeenCalledWith('o1')
    expect(result).toBeUndefined()
  })
})

describe('orderService – updateOrderStatus', () => {
  it('wraps status in an object when calling orderApi.updateStatus', async () => {
    const updated = makeOrder({ id: 'o1', status: 'completed' })
    vi.mocked(orderApi.updateStatus).mockResolvedValue(updated)

    const result = await orderService.updateOrderStatus('o1', 'completed')

    expect(orderApi.updateStatus).toHaveBeenCalledTimes(1)
    expect(orderApi.updateStatus).toHaveBeenCalledWith('o1', { status: 'completed' })
    expect(result).toBe(updated)
  })
})

describe('orderService – getMealStatistics', () => {
  it('calls orderApi.statistics() and returns the result', async () => {
    const stats: MealStatistic[] = [
      { name: 'Pizza', price: 250, quantity: 5, total: 1250 },
      { name: 'Burger', price: 120, quantity: 3, total: 360 },
    ]
    vi.mocked(orderApi.statistics).mockResolvedValue(stats)

    const result = await orderService.getMealStatistics()

    expect(orderApi.statistics).toHaveBeenCalledTimes(1)
    expect(orderApi.statistics).toHaveBeenCalledWith()
    expect(result).toBe(stats)
  })
})

describe('orderService – mapOrderItemsToCreateInput', () => {
  it('maps a single item with a note, dropping name and price', () => {
    const items: OrderItem[] = [
      makeItem({ menuItemId: 'm1', name: 'Pizza', price: 250, quantity: 2, note: 'extra cheese' }),
    ]

    const result = orderService.mapOrderItemsToCreateInput(items)

    expect(result).toEqual([{ menuItemId: 'm1', quantity: 2, note: 'extra cheese' }])
  })

  it('maps multiple items, preserving menuItemId, quantity and note only', () => {
    const items: OrderItem[] = [
      makeItem({ menuItemId: 'm1', name: 'Pizza', price: 250, quantity: 2, note: 'extra cheese' }),
      makeItem({ menuItemId: 'm2', name: 'Burger', price: 120, quantity: 1, note: 'no onions' }),
      makeItem({ menuItemId: 'm3', name: 'Salad', price: 90, quantity: 3, note: '' }),
    ]

    const result = orderService.mapOrderItemsToCreateInput(items)

    expect(result).toEqual([
      { menuItemId: 'm1', quantity: 2, note: 'extra cheese' },
      { menuItemId: 'm2', quantity: 1, note: 'no onions' },
      { menuItemId: 'm3', quantity: 3, note: '' },
    ])
  })

  it('returns an empty array for empty input', () => {
    expect(orderService.mapOrderItemsToCreateInput([])).toEqual([])
  })

  it('preserves empty notes', () => {
    const items: OrderItem[] = [
      makeItem({ menuItemId: 'm1', name: 'Pizza', price: 250, quantity: 1, note: '' }),
    ]

    const result = orderService.mapOrderItemsToCreateInput(items)

    expect(result).toEqual([{ menuItemId: 'm1', quantity: 1, note: '' }])
  })
})
