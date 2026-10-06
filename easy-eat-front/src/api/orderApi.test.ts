import { beforeEach, describe, it, expect, vi } from 'vitest'

vi.mock('@/mock/server', () => ({
  createOrder: vi.fn(),
  deleteOrder: vi.fn(),
  getOrderById: vi.fn(),
  listMealStatistics: vi.fn(),
  listOrders: vi.fn(),
  submitOrder: vi.fn(),
  updateOrder: vi.fn(),
  updateOrderStatus: vi.fn(),
}))

import {
  createOrder,
  deleteOrder,
  getOrderById,
  listMealStatistics,
  listOrders,
  submitOrder,
  updateOrder,
  updateOrderStatus,
} from '@/mock/server'
import { orderApi } from '@/api/orderApi'
import type {
  CreateOrderInput,
  MealStatistic,
  Order,
  UpdateOrderInput,
  UpdateOrderStatusInput,
} from '@/types/order'

describe('orderApi', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('list() calls listOrders and returns its result', async () => {
    const expected: Order[] = [
      {
        id: '1',
        orderId: 'ORD-1',
        restaurantId: 'r1',
        restaurantName: 'Restaurant A',
        items: [],
        totalAmount: 0,
        status: 'pending',
        createdAt: '2024-01-01T00:00:00.000Z',
      },
    ]
    vi.mocked(listOrders).mockResolvedValue(expected)

    const result = await orderApi.list()

    expect(listOrders).toHaveBeenCalledTimes(1)
    expect(listOrders).toHaveBeenCalledWith()
    expect(result).toBe(expected)
  })

  it('detail(id) calls getOrderById with id and returns its result', async () => {
    const expected: Order = {
      id: '1',
      orderId: 'ORD-1',
      restaurantId: 'r1',
      restaurantName: 'Restaurant A',
      items: [],
      totalAmount: 0,
      status: 'pending',
      createdAt: '2024-01-01T00:00:00.000Z',
    }
    vi.mocked(getOrderById).mockResolvedValue(expected)

    const result = await orderApi.detail('1')

    expect(getOrderById).toHaveBeenCalledTimes(1)
    expect(getOrderById).toHaveBeenCalledWith('1')
    expect(result).toBe(expected)
  })

  it('create(payload) calls createOrder with default status "pending"', async () => {
    const payload: CreateOrderInput = {
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 2, note: 'no onions' }],
    }
    const expected: Order = {
      id: '2',
      orderId: 'ORD-2',
      restaurantId: 'r1',
      restaurantName: 'Restaurant A',
      items: [],
      totalAmount: 10,
      status: 'pending',
      createdAt: '2024-01-02T00:00:00.000Z',
    }
    vi.mocked(createOrder).mockResolvedValue(expected)

    const result = await orderApi.create(payload)

    expect(createOrder).toHaveBeenCalledTimes(1)
    expect(createOrder).toHaveBeenCalledWith(payload, 'pending')
    expect(result).toBe(expected)
  })

  it('create(payload, status) forwards explicit status to createOrder', async () => {
    const payload: CreateOrderInput = {
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, note: '' }],
    }
    const expected: Order = {
      id: '3',
      orderId: 'ORD-3',
      restaurantId: 'r1',
      restaurantName: 'Restaurant A',
      items: [],
      totalAmount: 5,
      status: 'draft',
      createdAt: '2024-01-03T00:00:00.000Z',
    }
    vi.mocked(createOrder).mockResolvedValue(expected)

    const result = await orderApi.create(payload, 'draft')

    expect(createOrder).toHaveBeenCalledTimes(1)
    expect(createOrder).toHaveBeenCalledWith(payload, 'draft')
    expect(result).toBe(expected)
  })

  it('update(id, payload) calls updateOrder with id and payload and returns its result', async () => {
    const id = '1'
    const payload: UpdateOrderInput = {
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 3, note: 'extra spicy' }],
    }
    const expected: Order = {
      id: '1',
      orderId: 'ORD-1',
      restaurantId: 'r1',
      restaurantName: 'Restaurant A',
      items: [],
      totalAmount: 15,
      status: 'pending',
      createdAt: '2024-01-04T00:00:00.000Z',
    }
    vi.mocked(updateOrder).mockResolvedValue(expected)

    const result = await orderApi.update(id, payload)

    expect(updateOrder).toHaveBeenCalledTimes(1)
    expect(updateOrder).toHaveBeenCalledWith(id, payload)
    expect(result).toBe(expected)
  })

  it('submit(id) calls submitOrder with id and returns its result', async () => {
    const expected: Order = {
      id: '1',
      orderId: 'ORD-1',
      restaurantId: 'r1',
      restaurantName: 'Restaurant A',
      items: [],
      totalAmount: 0,
      status: 'pending',
      createdAt: '2024-01-05T00:00:00.000Z',
    }
    vi.mocked(submitOrder).mockResolvedValue(expected)

    const result = await orderApi.submit('1')

    expect(submitOrder).toHaveBeenCalledTimes(1)
    expect(submitOrder).toHaveBeenCalledWith('1')
    expect(result).toBe(expected)
  })

  it('remove(id) calls deleteOrder with id and returns its result', async () => {
    vi.mocked(deleteOrder).mockResolvedValue(undefined)

    const result = await orderApi.remove('1')

    expect(deleteOrder).toHaveBeenCalledTimes(1)
    expect(deleteOrder).toHaveBeenCalledWith('1')
    expect(result).toBeUndefined()
  })

  it('updateStatus(id, payload) calls updateOrderStatus with id and payload and returns its result', async () => {
    const id = '1'
    const payload: UpdateOrderStatusInput = { status: 'completed' }
    const expected: Order = {
      id: '1',
      orderId: 'ORD-1',
      restaurantId: 'r1',
      restaurantName: 'Restaurant A',
      items: [],
      totalAmount: 0,
      status: 'completed',
      createdAt: '2024-01-06T00:00:00.000Z',
    }
    vi.mocked(updateOrderStatus).mockResolvedValue(expected)

    const result = await orderApi.updateStatus(id, payload)

    expect(updateOrderStatus).toHaveBeenCalledTimes(1)
    expect(updateOrderStatus).toHaveBeenCalledWith(id, payload)
    expect(result).toBe(expected)
  })

  it('statistics() calls listMealStatistics and returns its result', async () => {
    const expected: MealStatistic[] = [{ name: 'Burger', price: 10, quantity: 3, total: 30 }]
    vi.mocked(listMealStatistics).mockResolvedValue(expected)

    const result = await orderApi.statistics()

    expect(listMealStatistics).toHaveBeenCalledTimes(1)
    expect(listMealStatistics).toHaveBeenCalledWith()
    expect(result).toBe(expected)
  })
})
