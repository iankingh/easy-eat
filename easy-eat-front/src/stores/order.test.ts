import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useOrderStore } from '@/stores/order'
import type { Order } from '@/types/order'

// ── helpers ─────────────────────────────────────────────────────────
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

// ── mock orderService ────────────────────────────────────────────────
vi.mock('@/services/orderService', () => ({
  orderService: {
    getOrders: vi.fn(async () => []),
    createOrder: vi.fn(async () => makeOrder()),
    deleteOrder: vi.fn(async () => undefined),
    updateOrderStatus: vi.fn(async (_id: string, status: string) =>
      makeOrder({ status: status as Order['status'] }),
    ),
    getMealStatistics: vi.fn(async () => []),
    mapOrderItemsToCreateInput: vi.fn((items) =>
      items.map((i: Order['items'][0]) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        note: i.note,
      })),
    ),
  },
}))

import { orderService } from '@/services/orderService'

// ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useOrderStore – initialize', () => {
  it('loads orders from service on first call', async () => {
    const orders = [makeOrder()]
    vi.mocked(orderService.getOrders).mockResolvedValueOnce(orders)

    const store = useOrderStore()
    await store.initialize()

    expect(store.orders).toHaveLength(1)
    expect(store.initialized).toBe(true)
  })

  it('skips loading if already initialized', async () => {
    const store = useOrderStore()
    await store.initialize()
    await store.initialize() // second call should be no-op

    expect(orderService.getOrders).toHaveBeenCalledTimes(1)
  })

  it('force=true reloads even when initialized', async () => {
    const store = useOrderStore()
    await store.initialize()
    await store.initialize(true)

    expect(orderService.getOrders).toHaveBeenCalledTimes(2)
  })
})

describe('useOrderStore – createOrder', () => {
  it('prepends the new order to the list', async () => {
    const store = useOrderStore()
    store.orders = []
    const newOrder = makeOrder({ id: 'new1' })
    vi.mocked(orderService.createOrder).mockResolvedValueOnce(newOrder)

    const result = await store.createOrder('r1', 'HOT8', newOrder.items)

    expect(result.id).toBe('new1')
    expect(store.orders[0].id).toBe('new1')
  })
})

describe('useOrderStore – deleteOrder', () => {
  it('removes the order from the list', async () => {
    const store = useOrderStore()
    store.orders = [makeOrder({ id: 'o1' }), makeOrder({ id: 'o2' })]

    await store.deleteOrder('o1')

    expect(store.orders.find((o) => o.id === 'o1')).toBeUndefined()
    expect(store.orders).toHaveLength(1)
  })
})

describe('useOrderStore – updateOrderStatus', () => {
  it('updates the status of an existing order in the list', async () => {
    const store = useOrderStore()
    store.orders = [makeOrder({ id: 'o1', status: 'pending' })]

    vi.mocked(orderService.updateOrderStatus).mockResolvedValueOnce(
      makeOrder({ id: 'o1', status: 'completed' }),
    )

    await store.updateOrderStatus('o1', 'completed')

    expect(store.orders[0].status).toBe('completed')
  })
})

describe('useOrderStore – getOrderById', () => {
  it('returns the order when id matches', () => {
    const store = useOrderStore()
    store.orders = [makeOrder({ id: 'o99' })]

    const found = store.getOrderById('o99')
    expect(found).toBeDefined()
    expect(found!.id).toBe('o99')
  })

  it('returns undefined for unknown id', () => {
    const store = useOrderStore()
    store.orders = []

    expect(store.getOrderById('x')).toBeUndefined()
  })
})

describe('useOrderStore – filteredOrders', () => {
  function setupOrders(store: ReturnType<typeof useOrderStore>) {
    store.orders = [
      makeOrder({ id: 'o1', status: 'pending', restaurantName: 'HOT8', createdAt: '2026-06-20T10:00:00Z' }),
      makeOrder({ id: 'o2', status: 'completed', restaurantName: '新巴克', createdAt: '2026-06-21T10:00:00Z' }),
      makeOrder({ id: 'o3', status: 'cancelled', restaurantName: 'HOT8', createdAt: '2026-06-22T10:00:00Z' }),
    ]
  }

  it('returns all orders when no filter applied', () => {
    const store = useOrderStore()
    setupOrders(store)
    expect(store.filteredOrders).toHaveLength(3)
  })

  it('filters by status', () => {
    const store = useOrderStore()
    setupOrders(store)
    store.filterStatus = 'completed'
    expect(store.filteredOrders).toHaveLength(1)
    expect(store.filteredOrders[0].id).toBe('o2')
  })

  it('filters by restaurant name (case-insensitive)', () => {
    const store = useOrderStore()
    setupOrders(store)
    store.filterRestaurant = 'hot8'
    expect(store.filteredOrders).toHaveLength(2)
  })

  it('filters by date range', () => {
    const store = useOrderStore()
    setupOrders(store)
    store.filterDateFrom = '2026-06-21'
    store.filterDateTo = '2026-06-21'
    expect(store.filteredOrders).toHaveLength(1)
    expect(store.filteredOrders[0].id).toBe('o2')
  })
})

describe('useOrderStore – mealStatistics', () => {
  it('aggregates item quantities across orders', () => {
    const store = useOrderStore()
    store.orders = [
      makeOrder({
        id: 'o1',
        items: [{ menuItemId: 'm1', name: 'Pizza', price: 250, quantity: 2, note: '' }],
      }),
      makeOrder({
        id: 'o2',
        items: [{ menuItemId: 'm1', name: 'Pizza', price: 250, quantity: 3, note: '' }],
      }),
    ]

    const stats = store.mealStatistics
    expect(stats).toHaveLength(1)
    expect(stats[0].quantity).toBe(5)
    expect(stats[0].total).toBe(1250)
  })
})

describe('useOrderStore – resetFilters', () => {
  it('clears all filter fields', () => {
    const store = useOrderStore()
    store.filterStatus = 'completed'
    store.filterRestaurant = 'test'
    store.filterDateFrom = '2026-01-01'
    store.filterDateTo = '2026-12-31'

    store.resetFilters()

    expect(store.filterStatus).toBe('')
    expect(store.filterRestaurant).toBe('')
    expect(store.filterDateFrom).toBe('')
    expect(store.filterDateTo).toBe('')
  })
})
