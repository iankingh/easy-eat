import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuCategory, MenuItem, Restaurant } from '@/types/restaurant'

// ── mock @/mock/server ────────────────────────────────────────────
vi.mock('@/mock/server', () => ({
  listRestaurants: vi.fn(),
  createRestaurant: vi.fn(),
  updateRestaurant: vi.fn(),
  setRestaurantEnabled: vi.fn(),
  deleteRestaurant: vi.fn(),
  createMenuItem: vi.fn(),
  updateMenuItem: vi.fn(),
  setMenuItemEnabled: vi.fn(),
  deleteMenuItem: vi.fn(),
  listCategories: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
  setCategoryEnabled: vi.fn(),
  deleteCategory: vi.fn(),
  resetMockServerData: vi.fn(),
}))

import {
  listRestaurants,
  createRestaurant,
  updateRestaurant,
  setRestaurantEnabled,
  deleteRestaurant,
  createMenuItem,
  updateMenuItem,
  setMenuItemEnabled,
  deleteMenuItem,
  listCategories,
  createCategory,
  updateCategory,
  setCategoryEnabled,
  deleteCategory,
  resetMockServerData,
} from '@/mock/server'
import { restaurantApi } from '@/api/restaurantApi'

// ── fixtures ───────────────────────────────────────────────────────
const restaurant: Restaurant = {
  id: 'r1',
  name: 'HOT8',
  enabled: true,
  menuItems: [],
}

const menuItem: MenuItem = {
  id: 'm1',
  name: 'Pizza',
  price: 250,
  categoryId: 'c1',
  enabled: true,
}

const category: MenuCategory = {
  id: 'c1',
  name: '食物',
  enabled: true,
}

// ────────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
})

describe('restaurantApi', () => {
  it('list() calls listRestaurants and returns the result', async () => {
    vi.mocked(listRestaurants).mockResolvedValue([restaurant])
    const result = await restaurantApi.list()
    expect(listRestaurants).toHaveBeenCalledTimes(1)
    expect(result).toEqual([restaurant])
  })

  it('createRestaurant(payload) calls createRestaurant and returns the result', async () => {
    vi.mocked(createRestaurant).mockResolvedValue(restaurant)
    const result = await restaurantApi.createRestaurant({ name: 'HOT8' })
    expect(createRestaurant).toHaveBeenCalledTimes(1)
    expect(createRestaurant).toHaveBeenCalledWith({ name: 'HOT8' })
    expect(result).toEqual(restaurant)
  })

  it('updateRestaurant(id, payload) calls updateRestaurant and returns the result', async () => {
    vi.mocked(updateRestaurant).mockResolvedValue(restaurant)
    const result = await restaurantApi.updateRestaurant('r1', { name: 'HOT8' })
    expect(updateRestaurant).toHaveBeenCalledTimes(1)
    expect(updateRestaurant).toHaveBeenCalledWith('r1', { name: 'HOT8' })
    expect(result).toEqual(restaurant)
  })

  it('setRestaurantEnabled(id, enabled) calls setRestaurantEnabled and returns the result', async () => {
    vi.mocked(setRestaurantEnabled).mockResolvedValue({ ...restaurant, enabled: false })
    const result = await restaurantApi.setRestaurantEnabled('r1', false)
    expect(setRestaurantEnabled).toHaveBeenCalledTimes(1)
    expect(setRestaurantEnabled).toHaveBeenCalledWith('r1', false)
    expect(result).toEqual({ ...restaurant, enabled: false })
  })

  it('removeRestaurant(id) calls deleteRestaurant', async () => {
    vi.mocked(deleteRestaurant).mockResolvedValue(undefined)
    await restaurantApi.removeRestaurant('r1')
    expect(deleteRestaurant).toHaveBeenCalledTimes(1)
    expect(deleteRestaurant).toHaveBeenCalledWith('r1')
  })

  it('createMenuItem(restaurantId, payload) calls createMenuItem and returns the result', async () => {
    vi.mocked(createMenuItem).mockResolvedValue(menuItem)
    const result = await restaurantApi.createMenuItem('r1', {
      name: 'Pizza',
      price: 250,
      categoryId: 'c1',
    })
    expect(createMenuItem).toHaveBeenCalledTimes(1)
    expect(createMenuItem).toHaveBeenCalledWith('r1', {
      name: 'Pizza',
      price: 250,
      categoryId: 'c1',
    })
    expect(result).toEqual(menuItem)
  })

  it('updateMenuItem(restaurantId, menuItemId, payload) calls updateMenuItem and returns the result', async () => {
    vi.mocked(updateMenuItem).mockResolvedValue(menuItem)
    const result = await restaurantApi.updateMenuItem('r1', 'm1', {
      name: 'Pizza',
      price: 250,
      categoryId: 'c1',
    })
    expect(updateMenuItem).toHaveBeenCalledTimes(1)
    expect(updateMenuItem).toHaveBeenCalledWith('r1', 'm1', {
      name: 'Pizza',
      price: 250,
      categoryId: 'c1',
    })
    expect(result).toEqual(menuItem)
  })

  it('setMenuItemEnabled(restaurantId, menuItemId, enabled) calls setMenuItemEnabled and returns the result', async () => {
    vi.mocked(setMenuItemEnabled).mockResolvedValue({ ...menuItem, enabled: false })
    const result = await restaurantApi.setMenuItemEnabled('r1', 'm1', false)
    expect(setMenuItemEnabled).toHaveBeenCalledTimes(1)
    expect(setMenuItemEnabled).toHaveBeenCalledWith('r1', 'm1', false)
    expect(result).toEqual({ ...menuItem, enabled: false })
  })

  it('removeMenuItem(restaurantId, menuItemId) calls deleteMenuItem', async () => {
    vi.mocked(deleteMenuItem).mockResolvedValue(undefined)
    await restaurantApi.removeMenuItem('r1', 'm1')
    expect(deleteMenuItem).toHaveBeenCalledTimes(1)
    expect(deleteMenuItem).toHaveBeenCalledWith('r1', 'm1')
  })

  it('listCategories() calls listCategories and returns the result', async () => {
    vi.mocked(listCategories).mockResolvedValue([category])
    const result = await restaurantApi.listCategories()
    expect(listCategories).toHaveBeenCalledTimes(1)
    expect(result).toEqual([category])
  })

  it('createCategory(payload) calls createCategory and returns the result', async () => {
    vi.mocked(createCategory).mockResolvedValue(category)
    const result = await restaurantApi.createCategory({ name: '食物' })
    expect(createCategory).toHaveBeenCalledTimes(1)
    expect(createCategory).toHaveBeenCalledWith({ name: '食物' })
    expect(result).toEqual(category)
  })

  it('updateCategory(id, payload) calls updateCategory and returns the result', async () => {
    vi.mocked(updateCategory).mockResolvedValue(category)
    const result = await restaurantApi.updateCategory('c1', { name: '食物' })
    expect(updateCategory).toHaveBeenCalledTimes(1)
    expect(updateCategory).toHaveBeenCalledWith('c1', { name: '食物' })
    expect(result).toEqual(category)
  })

  it('setCategoryEnabled(id, enabled) calls setCategoryEnabled and returns the result', async () => {
    vi.mocked(setCategoryEnabled).mockResolvedValue({ ...category, enabled: false })
    const result = await restaurantApi.setCategoryEnabled('c1', false)
    expect(setCategoryEnabled).toHaveBeenCalledTimes(1)
    expect(setCategoryEnabled).toHaveBeenCalledWith('c1', false)
    expect(result).toEqual({ ...category, enabled: false })
  })

  it('removeCategory(id) calls deleteCategory', async () => {
    vi.mocked(deleteCategory).mockResolvedValue(undefined)
    await restaurantApi.removeCategory('c1')
    expect(deleteCategory).toHaveBeenCalledTimes(1)
    expect(deleteCategory).toHaveBeenCalledWith('c1')
  })

  it('resetMockData() calls resetMockServerData', async () => {
    vi.mocked(resetMockServerData).mockResolvedValue(undefined)
    await restaurantApi.resetMockData()
    expect(resetMockServerData).toHaveBeenCalledTimes(1)
  })
})
