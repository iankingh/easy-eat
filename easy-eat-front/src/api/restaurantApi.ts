import {
  createCategory,
  createMenuItem,
  createRestaurant,
  deleteCategory,
  deleteMenuItem,
  deleteRestaurant,
  listCategories,
  listRestaurants,
  resetMockServerData,
  setCategoryEnabled,
  setMenuItemEnabled,
  setRestaurantEnabled,
  updateCategory,
  updateMenuItem,
  updateRestaurant,
} from '@/mock/server'
import type {
  MenuCategory,
  MenuCategoryInput,
  MenuItem,
  MenuItemInput,
  Restaurant,
  RestaurantInput,
} from '@/types/restaurant'

export const restaurantApi = {
  list(): Promise<Restaurant[]> {
    return listRestaurants()
  },

  createRestaurant(payload: RestaurantInput): Promise<Restaurant> {
    return createRestaurant(payload)
  },

  updateRestaurant(id: string, payload: RestaurantInput): Promise<Restaurant> {
    return updateRestaurant(id, payload)
  },

  setRestaurantEnabled(id: string, enabled: boolean): Promise<Restaurant> {
    return setRestaurantEnabled(id, enabled)
  },

  removeRestaurant(id: string): Promise<void> {
    return deleteRestaurant(id)
  },

  createMenuItem(restaurantId: string, payload: MenuItemInput): Promise<MenuItem> {
    return createMenuItem(restaurantId, payload)
  },

  updateMenuItem(
    restaurantId: string,
    menuItemId: string,
    payload: MenuItemInput,
  ): Promise<MenuItem> {
    return updateMenuItem(restaurantId, menuItemId, payload)
  },

  setMenuItemEnabled(
    restaurantId: string,
    menuItemId: string,
    enabled: boolean,
  ): Promise<MenuItem> {
    return setMenuItemEnabled(restaurantId, menuItemId, enabled)
  },

  removeMenuItem(restaurantId: string, menuItemId: string): Promise<void> {
    return deleteMenuItem(restaurantId, menuItemId)
  },

  listCategories(): Promise<MenuCategory[]> {
    return listCategories()
  },

  createCategory(payload: MenuCategoryInput): Promise<MenuCategory> {
    return createCategory(payload)
  },

  updateCategory(id: string, payload: MenuCategoryInput): Promise<MenuCategory> {
    return updateCategory(id, payload)
  },

  setCategoryEnabled(id: string, enabled: boolean): Promise<MenuCategory> {
    return setCategoryEnabled(id, enabled)
  },

  removeCategory(id: string): Promise<void> {
    return deleteCategory(id)
  },

  resetMockData(): Promise<void> {
    return resetMockServerData()
  },
}
