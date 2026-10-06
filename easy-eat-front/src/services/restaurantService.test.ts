import { describe, it, expect, vi } from 'vitest'
import { restaurantService } from '@/services/restaurantService'
import type {
  MenuCategory,
  MenuCategoryInput,
  MenuItem,
  MenuItemInput,
  Restaurant,
  RestaurantInput,
} from '@/types/restaurant'

vi.mock('@/api/restaurantApi', () => ({
  restaurantApi: {
    list: vi.fn(),
    createRestaurant: vi.fn(),
    updateRestaurant: vi.fn(),
    setRestaurantEnabled: vi.fn(),
    removeRestaurant: vi.fn(),
    createMenuItem: vi.fn(),
    updateMenuItem: vi.fn(),
    setMenuItemEnabled: vi.fn(),
    removeMenuItem: vi.fn(),
    listCategories: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    setCategoryEnabled: vi.fn(),
    removeCategory: vi.fn(),
    resetMockData: vi.fn(),
  },
}))

import { restaurantApi } from '@/api/restaurantApi'

// ── helpers ─────────────────────────────────────────────────────────
function makeRestaurant(overrides: Partial<Restaurant> = {}): Restaurant {
  return {
    id: 'r1',
    name: 'HOT8',
    enabled: true,
    menuItems: [],
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

function makeCategory(overrides: Partial<MenuCategory> = {}): MenuCategory {
  return {
    id: 'c1',
    name: '食物',
    enabled: true,
    ...overrides,
  }
}

describe('restaurantService', () => {
  describe('getRestaurants', () => {
    it('calls restaurantApi.list() and returns the result', async () => {
      const expected: Restaurant[] = [makeRestaurant()]
      vi.mocked(restaurantApi.list).mockResolvedValue(expected)

      const result = await restaurantService.getRestaurants()

      expect(restaurantApi.list).toHaveBeenCalledTimes(1)
      expect(restaurantApi.list).toHaveBeenCalledWith()
      expect(result).toBe(expected)
    })
  })

  describe('createRestaurant', () => {
    it('calls restaurantApi.createRestaurant(payload) and returns the result', async () => {
      const payload: RestaurantInput = { name: 'HOT8' }
      const expected = makeRestaurant({ name: 'HOT8' })
      vi.mocked(restaurantApi.createRestaurant).mockResolvedValue(expected)

      const result = await restaurantService.createRestaurant(payload)

      expect(restaurantApi.createRestaurant).toHaveBeenCalledTimes(1)
      expect(restaurantApi.createRestaurant).toHaveBeenCalledWith(payload)
      expect(result).toBe(expected)
    })
  })

  describe('updateRestaurant', () => {
    it('calls restaurantApi.updateRestaurant(id, payload) and returns the result', async () => {
      const id = 'r1'
      const payload: RestaurantInput = { name: 'Updated' }
      const expected = makeRestaurant({ id, name: 'Updated' })
      vi.mocked(restaurantApi.updateRestaurant).mockResolvedValue(expected)

      const result = await restaurantService.updateRestaurant(id, payload)

      expect(restaurantApi.updateRestaurant).toHaveBeenCalledTimes(1)
      expect(restaurantApi.updateRestaurant).toHaveBeenCalledWith(id, payload)
      expect(result).toBe(expected)
    })
  })

  describe('setRestaurantEnabled', () => {
    it('calls restaurantApi.setRestaurantEnabled(id, enabled) and returns the result', async () => {
      const id = 'r1'
      const enabled = false
      const expected = makeRestaurant({ id, enabled: false })
      vi.mocked(restaurantApi.setRestaurantEnabled).mockResolvedValue(expected)

      const result = await restaurantService.setRestaurantEnabled(id, enabled)

      expect(restaurantApi.setRestaurantEnabled).toHaveBeenCalledTimes(1)
      expect(restaurantApi.setRestaurantEnabled).toHaveBeenCalledWith(id, enabled)
      expect(result).toBe(expected)
    })
  })

  describe('deleteRestaurant', () => {
    it('calls restaurantApi.removeRestaurant(id)', async () => {
      const id = 'r1'
      vi.mocked(restaurantApi.removeRestaurant).mockResolvedValue(undefined)

      const result = await restaurantService.deleteRestaurant(id)

      expect(restaurantApi.removeRestaurant).toHaveBeenCalledTimes(1)
      expect(restaurantApi.removeRestaurant).toHaveBeenCalledWith(id)
      expect(result).toBeUndefined()
    })
  })

  describe('createMenuItem', () => {
    it('calls restaurantApi.createMenuItem(restaurantId, payload) and returns the result', async () => {
      const restaurantId = 'r1'
      const payload: MenuItemInput = { name: 'Pizza', price: 250, categoryId: 'c1' }
      const expected = makeMenuItem({ id: 'm1', name: 'Pizza', price: 250, categoryId: 'c1' })
      vi.mocked(restaurantApi.createMenuItem).mockResolvedValue(expected)

      const result = await restaurantService.createMenuItem(restaurantId, payload)

      expect(restaurantApi.createMenuItem).toHaveBeenCalledTimes(1)
      expect(restaurantApi.createMenuItem).toHaveBeenCalledWith(restaurantId, payload)
      expect(result).toBe(expected)
    })
  })

  describe('updateMenuItem', () => {
    it('calls restaurantApi.updateMenuItem(restaurantId, menuItemId, payload) and returns the result', async () => {
      const restaurantId = 'r1'
      const menuItemId = 'm1'
      const payload: MenuItemInput = { name: 'Pizza Updated', price: 300, categoryId: 'c1' }
      const expected = makeMenuItem({
        id: menuItemId,
        name: 'Pizza Updated',
        price: 300,
        categoryId: 'c1',
      })
      vi.mocked(restaurantApi.updateMenuItem).mockResolvedValue(expected)

      const result = await restaurantService.updateMenuItem(restaurantId, menuItemId, payload)

      expect(restaurantApi.updateMenuItem).toHaveBeenCalledTimes(1)
      expect(restaurantApi.updateMenuItem).toHaveBeenCalledWith(restaurantId, menuItemId, payload)
      expect(result).toBe(expected)
    })
  })

  describe('setMenuItemEnabled', () => {
    it('calls restaurantApi.setMenuItemEnabled(restaurantId, menuItemId, enabled) and returns the result', async () => {
      const restaurantId = 'r1'
      const menuItemId = 'm1'
      const enabled = false
      const expected = makeMenuItem({ id: menuItemId, enabled: false })
      vi.mocked(restaurantApi.setMenuItemEnabled).mockResolvedValue(expected)

      const result = await restaurantService.setMenuItemEnabled(restaurantId, menuItemId, enabled)

      expect(restaurantApi.setMenuItemEnabled).toHaveBeenCalledTimes(1)
      expect(restaurantApi.setMenuItemEnabled).toHaveBeenCalledWith(
        restaurantId,
        menuItemId,
        enabled,
      )
      expect(result).toBe(expected)
    })
  })

  describe('deleteMenuItem', () => {
    it('calls restaurantApi.removeMenuItem(restaurantId, menuItemId)', async () => {
      const restaurantId = 'r1'
      const menuItemId = 'm1'
      vi.mocked(restaurantApi.removeMenuItem).mockResolvedValue(undefined)

      const result = await restaurantService.deleteMenuItem(restaurantId, menuItemId)

      expect(restaurantApi.removeMenuItem).toHaveBeenCalledTimes(1)
      expect(restaurantApi.removeMenuItem).toHaveBeenCalledWith(restaurantId, menuItemId)
      expect(result).toBeUndefined()
    })
  })

  describe('getCategories', () => {
    it('calls restaurantApi.listCategories() and returns the result', async () => {
      const expected: MenuCategory[] = [makeCategory()]
      vi.mocked(restaurantApi.listCategories).mockResolvedValue(expected)

      const result = await restaurantService.getCategories()

      expect(restaurantApi.listCategories).toHaveBeenCalledTimes(1)
      expect(restaurantApi.listCategories).toHaveBeenCalledWith()
      expect(result).toBe(expected)
    })
  })

  describe('createCategory', () => {
    it('calls restaurantApi.createCategory(payload) and returns the result', async () => {
      const payload: MenuCategoryInput = { name: '飲料' }
      const expected = makeCategory({ id: 'c2', name: '飲料' })
      vi.mocked(restaurantApi.createCategory).mockResolvedValue(expected)

      const result = await restaurantService.createCategory(payload)

      expect(restaurantApi.createCategory).toHaveBeenCalledTimes(1)
      expect(restaurantApi.createCategory).toHaveBeenCalledWith(payload)
      expect(result).toBe(expected)
    })
  })

  describe('updateCategory', () => {
    it('calls restaurantApi.updateCategory(id, payload) and returns the result', async () => {
      const id = 'c1'
      const payload: MenuCategoryInput = { name: '食物 Updated' }
      const expected = makeCategory({ id, name: '食物 Updated' })
      vi.mocked(restaurantApi.updateCategory).mockResolvedValue(expected)

      const result = await restaurantService.updateCategory(id, payload)

      expect(restaurantApi.updateCategory).toHaveBeenCalledTimes(1)
      expect(restaurantApi.updateCategory).toHaveBeenCalledWith(id, payload)
      expect(result).toBe(expected)
    })
  })

  describe('setCategoryEnabled', () => {
    it('calls restaurantApi.setCategoryEnabled(id, enabled) and returns the result', async () => {
      const id = 'c1'
      const enabled = false
      const expected = makeCategory({ id, enabled: false })
      vi.mocked(restaurantApi.setCategoryEnabled).mockResolvedValue(expected)

      const result = await restaurantService.setCategoryEnabled(id, enabled)

      expect(restaurantApi.setCategoryEnabled).toHaveBeenCalledTimes(1)
      expect(restaurantApi.setCategoryEnabled).toHaveBeenCalledWith(id, enabled)
      expect(result).toBe(expected)
    })
  })

  describe('deleteCategory', () => {
    it('calls restaurantApi.removeCategory(id)', async () => {
      const id = 'c1'
      vi.mocked(restaurantApi.removeCategory).mockResolvedValue(undefined)

      const result = await restaurantService.deleteCategory(id)

      expect(restaurantApi.removeCategory).toHaveBeenCalledTimes(1)
      expect(restaurantApi.removeCategory).toHaveBeenCalledWith(id)
      expect(result).toBeUndefined()
    })
  })

  describe('resetMockData', () => {
    it('calls restaurantApi.resetMockData()', async () => {
      vi.mocked(restaurantApi.resetMockData).mockResolvedValue(undefined)

      const result = await restaurantService.resetMockData()

      expect(restaurantApi.resetMockData).toHaveBeenCalledTimes(1)
      expect(restaurantApi.resetMockData).toHaveBeenCalledWith()
      expect(result).toBeUndefined()
    })
  })
})
