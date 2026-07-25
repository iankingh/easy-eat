import { restaurantApi } from '@/api/restaurantApi'
import type {
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

  deleteMenuItem(restaurantId: string, menuItemId: string): Promise<void> {
    return restaurantApi.removeMenuItem(restaurantId, menuItemId)
  },

  resetMockData(): Promise<void> {
    return restaurantApi.resetMockData()
  },
}
