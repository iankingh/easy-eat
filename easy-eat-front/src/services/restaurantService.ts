import { restaurantApi } from '@/api/restaurantApi'
import type {
  MenuCategory,
  MenuCategoryInput,
  MenuItem,
  MenuItemInput,
  Restaurant,
  RestaurantInput,
} from '@/types/restaurant'

export const restaurantService = {
  getRestaurants(): Promise<Restaurant[]> {
    return restaurantApi.list()
  },

  createRestaurant(payload: RestaurantInput): Promise<Restaurant> {
    return restaurantApi.createRestaurant(payload)
  },

  updateRestaurant(id: string, payload: RestaurantInput): Promise<Restaurant> {
    return restaurantApi.updateRestaurant(id, payload)
  },

  setRestaurantEnabled(id: string, enabled: boolean): Promise<Restaurant> {
    return restaurantApi.setRestaurantEnabled(id, enabled)
  },

  deleteRestaurant(id: string): Promise<void> {
    return restaurantApi.removeRestaurant(id)
  },

  createMenuItem(restaurantId: string, payload: MenuItemInput): Promise<MenuItem> {
    return restaurantApi.createMenuItem(restaurantId, payload)
  },

  updateMenuItem(
    restaurantId: string,
    menuItemId: string,
    payload: MenuItemInput,
  ): Promise<MenuItem> {
    return restaurantApi.updateMenuItem(restaurantId, menuItemId, payload)
  },

  setMenuItemEnabled(
    restaurantId: string,
    menuItemId: string,
    enabled: boolean,
  ): Promise<MenuItem> {
    return restaurantApi.setMenuItemEnabled(restaurantId, menuItemId, enabled)
  },

  deleteMenuItem(restaurantId: string, menuItemId: string): Promise<void> {
    return restaurantApi.removeMenuItem(restaurantId, menuItemId)
  },

  getCategories(): Promise<MenuCategory[]> {
    return restaurantApi.listCategories()
  },

  createCategory(payload: MenuCategoryInput): Promise<MenuCategory> {
    return restaurantApi.createCategory(payload)
  },

  updateCategory(id: string, payload: MenuCategoryInput): Promise<MenuCategory> {
    return restaurantApi.updateCategory(id, payload)
  },

  setCategoryEnabled(id: string, enabled: boolean): Promise<MenuCategory> {
    return restaurantApi.setCategoryEnabled(id, enabled)
  },

  deleteCategory(id: string): Promise<void> {
    return restaurantApi.removeCategory(id)
  },

  resetMockData(): Promise<void> {
    return restaurantApi.resetMockData()
  },
}
