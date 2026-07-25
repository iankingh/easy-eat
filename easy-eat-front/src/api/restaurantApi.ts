import {
  createMenuItem,
  createRestaurant,
  deleteMenuItem,
  deleteRestaurant,
  listRestaurants,
  resetMockServerData,
  updateMenuItem,
  updateRestaurant,
} from '@/mock/server'
import type {
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

  removeMenuItem(restaurantId: string, menuItemId: string): Promise<void> {
    return deleteMenuItem(restaurantId, menuItemId)
  },

  resetMockData(): Promise<void> {
    return resetMockServerData()
  },
}
