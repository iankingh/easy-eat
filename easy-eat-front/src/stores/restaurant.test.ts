import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useRestaurantStore } from '@/stores/restaurant'
import type { MenuItem, Restaurant } from '@/types/restaurant'

// ── helpers ─────────────────────────────────────────────────────────
function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'r1',
    name: 'HOT8',
    enabled: true,
    menuItems: [{ id: 'm1', name: 'Pizza', price: 250, categoryId: 'c1', enabled: true }],
    ...overrides,
  }
}

function makeMenuItem(overrides: Partial<MenuItem> = {}): MenuItem {
  return {
    id: 'm1',
    name: 'Pizza',
    price: 250,
    categoryId: 'c1',
    enabled: true,
    ...overrides,
  }
}

// ── mock restaurantService ────────────────────────────────────────
vi.mock('@/services/restaurantService', () => ({
  restaurantService: {
    getRestaurants: vi.fn(async () => []),
    getCategories: vi.fn(async () => [{ id: 'c1', name: '食物', enabled: true }]),
    createRestaurant: vi.fn(async (p: { name: string }) =>
      makeRestaurant({ name: p.name, menuItems: [] }),
    ),
    updateRestaurant: vi.fn(async (_id: string, p: { name: string }) =>
      makeRestaurant({ name: p.name }),
    ),
    deleteRestaurant: vi.fn(async () => undefined),
    setRestaurantEnabled: vi.fn(async (_id: string, enabled: boolean) =>
      makeRestaurant({ enabled }),
    ),
    createMenuItem: vi.fn(async (_rid: string, item: Omit<MenuItem, 'id'>) =>
      makeMenuItem({ ...item, id: 'mnew' }),
    ),
    updateMenuItem: vi.fn(async (_rid: string, id: string, item: Omit<MenuItem, 'id'>) =>
      makeMenuItem({ ...item, id }),
    ),
    deleteMenuItem: vi.fn(async () => undefined),
    setMenuItemEnabled: vi.fn(async (_rid: string, id: string, enabled: boolean) =>
      makeMenuItem({ id, enabled }),
    ),
    createCategory: vi.fn(async (p: { name: string }) => ({
      id: 'c-new',
      name: p.name,
      enabled: true,
    })),
    updateCategory: vi.fn(async (id: string, p: { name: string }) => ({
      id,
      name: p.name,
      enabled: true,
    })),
    setCategoryEnabled: vi.fn(async (id: string, enabled: boolean) => ({
      id,
      name: '食物',
      enabled,
    })),
    deleteCategory: vi.fn(async () => undefined),
    resetMockData: vi.fn(async () => undefined),
  },
}))

import { restaurantService } from '@/services/restaurantService'

// ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('useRestaurantStore – initialize', () => {
  it('loads restaurants on first call', async () => {
    vi.mocked(restaurantService.getRestaurants).mockResolvedValueOnce([makeRestaurant()])
    const store = useRestaurantStore()
    await store.initialize()
    expect(store.restaurants).toHaveLength(1)
    expect(store.initialized).toBe(true)
  })

  it('skips loading when already initialized', async () => {
    const store = useRestaurantStore()
    await store.initialize()
    await store.initialize()
    expect(restaurantService.getRestaurants).toHaveBeenCalledTimes(1)
  })

  it('stores service errors and clears loading state', async () => {
    vi.mocked(restaurantService.getRestaurants).mockRejectedValueOnce(new Error('載入失敗'))
    const store = useRestaurantStore()

    await expect(store.initialize()).rejects.toThrow('載入失敗')

    expect(store.errorMessage).toBe('載入失敗')
    expect(store.loading).toBe(false)
  })
})

describe('useRestaurantStore – addRestaurant', () => {
  it('appends the new restaurant', async () => {
    const store = useRestaurantStore()
    store.restaurants = []
    const added = await store.addRestaurant('新館')
    expect(added).not.toBeNull()
    expect(store.restaurants).toHaveLength(1)
  })

  it('rejects a blank restaurant name', async () => {
    const store = useRestaurantStore()
    store.restaurants = []
    await expect(store.addRestaurant('   ')).rejects.toThrow('餐廳名稱不可為空')
    expect(store.restaurants).toHaveLength(0)
  })
})

describe('useRestaurantStore – updateRestaurant', () => {
  it('updates the restaurant name in the list', async () => {
    const store = useRestaurantStore()
    store.restaurants = [makeRestaurant({ id: 'r1', name: '舊名' })]
    vi.mocked(restaurantService.updateRestaurant).mockResolvedValueOnce(
      makeRestaurant({ id: 'r1', name: '新名' }),
    )
    await store.updateRestaurant('r1', '新名')
    expect(store.restaurants[0].name).toBe('新名')
  })

  it('rejects a blank restaurant name', async () => {
    const store = useRestaurantStore()
    store.restaurants = [makeRestaurant({ id: 'r1', name: '舊名' })]
    await expect(store.updateRestaurant('r1', '   ')).rejects.toThrow('餐廳名稱不可為空')
    expect(store.restaurants[0].name).toBe('舊名')
    expect(restaurantService.updateRestaurant).not.toHaveBeenCalled()
  })
})

describe('useRestaurantStore – deleteRestaurant', () => {
  it('removes the restaurant from the list', async () => {
    const store = useRestaurantStore()
    store.restaurants = [makeRestaurant({ id: 'r1' }), makeRestaurant({ id: 'r2', name: '新館' })]
    await store.deleteRestaurant('r1')
    expect(store.restaurants.find((r) => r.id === 'r1')).toBeUndefined()
    expect(store.restaurants).toHaveLength(1)
  })
})

describe('useRestaurantStore – addMenuItem', () => {
  it('appends a menu item to the correct restaurant', async () => {
    const store = useRestaurantStore()
    store.categories = [{ id: 'c1', name: '食物', enabled: true }]
    store.restaurants = [makeRestaurant({ id: 'r1', menuItems: [] })]
    await store.addMenuItem('r1', { name: '漢堡', price: 100, categoryId: 'c1' })
    expect(store.restaurants[0].menuItems).toHaveLength(1)
    expect(store.restaurants[0].menuItems[0].name).toBe('漢堡')
  })
})

describe('useRestaurantStore – updateMenuItem', () => {
  it('updates the menu item in place', async () => {
    const store = useRestaurantStore()
    store.categories = [{ id: 'c1', name: '食物', enabled: true }]
    store.restaurants = [makeRestaurant({ id: 'r1', menuItems: [makeMenuItem({ id: 'm1' })] })]
    vi.mocked(restaurantService.updateMenuItem).mockResolvedValueOnce(
      makeMenuItem({ id: 'm1', name: '雙層漢堡', price: 180, categoryId: 'c1' }),
    )
    await store.updateMenuItem('r1', 'm1', { name: '雙層漢堡', price: 180, categoryId: 'c1' })
    expect(store.restaurants[0].menuItems[0].name).toBe('雙層漢堡')
  })

  describe('useRestaurantStore – enabled state and categories', () => {
    it('updates restaurant enabled state', async () => {
      const store = useRestaurantStore()
      store.restaurants = [makeRestaurant({ id: 'r1', enabled: true })]

      await store.setRestaurantEnabled('r1', false)

      expect(store.restaurants[0].enabled).toBe(false)
    })

    it('creates and removes an unused category', async () => {
      const store = useRestaurantStore()
      store.categories = [{ id: 'c1', name: '食物', enabled: true }]

      const created = await store.addCategory('早餐')
      expect(created.name).toBe('早餐')

      await store.deleteCategory(created.id)
      expect(store.categories.some((category) => category.id === created.id)).toBe(false)
    })

    it('filters active restaurants and disabled menu items', () => {
      const store = useRestaurantStore()
      store.categories = [{ id: 'c1', name: '食物', enabled: true }]
      store.restaurants = [
        makeRestaurant({
          menuItems: [
            makeMenuItem({ id: 'm1', enabled: true }),
            makeMenuItem({ id: 'm2', enabled: false }),
          ],
        }),
        makeRestaurant({ id: 'r2', enabled: false }),
      ]

      expect(store.activeRestaurants).toHaveLength(1)
      expect(store.activeRestaurants[0].menuItems.map((item) => item.id)).toEqual(['m1'])
    })
  })
})

describe('useRestaurantStore – deleteMenuItem', () => {
  it('removes the menu item from the restaurant', async () => {
    const store = useRestaurantStore()
    store.restaurants = [makeRestaurant({ id: 'r1', menuItems: [makeMenuItem({ id: 'm1' })] })]
    await store.deleteMenuItem('r1', 'm1')
    expect(store.restaurants[0].menuItems).toHaveLength(0)
  })
})

describe('useRestaurantStore – getRestaurantById', () => {
  it('returns the restaurant when id matches', () => {
    const store = useRestaurantStore()
    store.restaurants = [makeRestaurant({ id: 'r1' })]
    expect(store.getRestaurantById('r1')).toBeDefined()
  })

  it('returns undefined for unknown id', () => {
    const store = useRestaurantStore()
    store.restaurants = []
    expect(store.getRestaurantById('r99')).toBeUndefined()
  })
})
