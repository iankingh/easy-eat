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
    updateOrder: vi.fn(async () => makeOrder()),
    submitOrder: vi.fn(async () => makeOrder({ status: 'pending' })),
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

  it('stores service errors and clears loading state', async () => {
    vi.mocked(orderService.getOrders).mockRejectedValueOnce(new Error('載入失敗'))
    const store = useOrderStore()

    await expect(store.initialize()).rejects.toThrow('載入失敗')

    expect(store.errorMessage).toBe('載入失敗')
    expect(store.loading).toBe(false)
  })
})

describe('useOrderStore – createOrder', () => {
  it('prepends the new order to the list', async () => {
    const store = useOrderStore()
    store.orders = []
    const newOrder = makeOrder({ id: 'new1' })
    vi.mocked(orderService.createOrder).mockResolvedValueOnce(newOrder)

    const result = await store.createOrder('r1', newOrder.items)

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

  describe('useOrderStore – draft workflow', () => {
    it('saves a draft and prepends it to the list', async () => {
      const store = useOrderStore()
      const draft = makeOrder({ id: 'draft-1', status: 'draft' })
      vi.mocked(orderService.createOrder).mockResolvedValueOnce(draft)

      const result = await store.saveDraft('r1', draft.items)

      expect(result.status).toBe('draft')
      expect(orderService.createOrder).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: 'r1' }),
        'draft',
      )
    })

    it('submits a stored draft', async () => {
      const store = useOrderStore()
      store.orders = [makeOrder({ id: 'draft-1', status: 'draft' })]
      vi.mocked(orderService.submitOrder).mockResolvedValueOnce(
        makeOrder({ id: 'draft-1', status: 'pending' }),
      )

      await store.submitDraft('draft-1')

      expect(store.orders[0].status).toBe('pending')
    })
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
      makeOrder({
        id: 'o1',
        status: 'pending',
        restaurantName: 'HOT8',
        createdAt: '2026-06-20T10:00:00Z',
      }),
      makeOrder({
        id: 'o2',
        status: 'completed',
        restaurantName: '新巴克',
        createdAt: '2026-06-21T10:00:00Z',
      }),
      makeOrder({
        id: 'o3',
        status: 'cancelled',
        restaurantName: 'HOT8',
        createdAt: '2026-06-22T10:00:00Z',
      }),
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

  it('filters by the local calendar date through the end of the day', () => {
    const store = useOrderStore()
    const localDate = new Date(2026, 5, 21, 23, 59, 59, 999)
    store.orders = [makeOrder({ id: 'late-order', createdAt: localDate.toISOString() })]
    store.filterDateFrom = '2026-06-21'
    store.filterDateTo = '2026-06-21'

    expect(store.filteredOrders.map((order) => order.id)).toEqual(['late-order'])
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

  describe('useOrderStore – sorting and pagination', () => {
    it('sorts by amount and paginates with 20 rows per page', () => {
      const store = useOrderStore()
      store.orders = Array.from({ length: 25 }, (_, index) =>
        makeOrder({
          id: `o${index}`,
          orderId: `order-${index}`,
          totalAmount: index,
          createdAt: `2026-06-${String((index % 28) + 1).padStart(2, '0')}T10:00:00Z`,
        }),
      )
      store.sortBy = 'totalAmount'
      store.sortDirection = 'desc'

      expect(store.totalPages).toBe(2)
      expect(store.paginatedOrders).toHaveLength(20)
      expect(store.paginatedOrders[0].totalAmount).toBe(24)

      store.currentPage = 2
      expect(store.paginatedOrders).toHaveLength(5)
    })

    it('searches order id, restaurant and item text', () => {
      const store = useOrderStore()
      store.orders = [
        makeOrder({ id: 'o1', orderId: 'SPECIAL-001' }),
        makeOrder({ id: 'o2', restaurantName: '測試餐廳' }),
      ]
      store.searchQuery = 'special'

      expect(store.filteredOrders.map((order) => order.id)).toEqual(['o1'])
    })
  })
})
