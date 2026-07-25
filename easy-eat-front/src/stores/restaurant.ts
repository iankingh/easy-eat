import { defineStore } from 'pinia'
import { ref } from 'vue'
import { restaurantService } from '@/services/restaurantService'
import type { MenuItemInput, Restaurant } from '@/types/restaurant'

export type { MenuItem, Restaurant } from '@/types/restaurant'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '發生未知錯誤，請稍後再試'
}

export const useRestaurantStore = defineStore('restaurant', () => {
  const restaurants = ref<Restaurant[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const errorMessage = ref<string | null>(null)

  async function initialize(force = false) {
    if (initialized.value && !force) {
      return
    }

    loading.value = true
    errorMessage.value = null

    try {
      restaurants.value = await restaurantService.getRestaurants()
      initialized.value = true
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function addRestaurant(name: string): Promise<Restaurant | null> {
    const safeName = name.trim()
    if (!safeName) {
      return null
    }

    loading.value = true
    errorMessage.value = null

    try {
      const restaurant = await restaurantService.createRestaurant({ name: safeName })
      restaurants.value.push(restaurant)
      return restaurant
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function updateRestaurant(id: string, name: string) {
    const safeName = name.trim()
    if (!safeName) {
      return
    }

    loading.value = true
    errorMessage.value = null

    try {
      const updated = await restaurantService.updateRestaurant(id, { name: safeName })
      const restaurant = restaurants.value.find((item) => item.id === id)
      if (restaurant) {
        restaurant.name = updated.name
      }
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function deleteRestaurant(id: string) {
    loading.value = true
    errorMessage.value = null

    try {
      await restaurantService.deleteRestaurant(id)
      restaurants.value = restaurants.value.filter((restaurant) => restaurant.id !== id)
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function addMenuItem(restaurantId: string, item: MenuItemInput) {
    const safeName = item.name.trim()
    if (!safeName) {
      return
    }

    loading.value = true
    errorMessage.value = null

    try {
      const created = await restaurantService.createMenuItem(restaurantId, {
        ...item,
        name: safeName,
      })

      const restaurant = restaurants.value.find((entity) => entity.id === restaurantId)
      if (restaurant) {
        restaurant.menuItems.push(created)
      }
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function updateMenuItem(restaurantId: string, itemId: string, data: MenuItemInput) {
    const safeName = data.name.trim()
    if (!safeName) {
      return
    }

    loading.value = true
    errorMessage.value = null

    try {
      const updated = await restaurantService.updateMenuItem(restaurantId, itemId, {
        ...data,
        name: safeName,
      })

      const restaurant = restaurants.value.find((entity) => entity.id === restaurantId)
      if (!restaurant) {
        return
      }

      const menuItem = restaurant.menuItems.find((entity) => entity.id === itemId)
      if (menuItem) {
        menuItem.name = updated.name
        menuItem.price = updated.price
        menuItem.category = updated.category
      }
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function deleteMenuItem(restaurantId: string, itemId: string) {
    loading.value = true
    errorMessage.value = null

    try {
      await restaurantService.deleteMenuItem(restaurantId, itemId)

      const restaurant = restaurants.value.find((entity) => entity.id === restaurantId)
      if (!restaurant) {
        return
      }

      restaurant.menuItems = restaurant.menuItems.filter((item) => item.id !== itemId)
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function resetMockData() {
    loading.value = true
    errorMessage.value = null

    try {
      await restaurantService.resetMockData()
      await initialize(true)
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  function getRestaurantById(id: string) {
    return restaurants.value.find((restaurant) => restaurant.id === id)
  }

  function clearError() {
    errorMessage.value = null
  }

  return {
    restaurants,
    loading,
    initialized,
    errorMessage,
    initialize,
    addRestaurant,
    updateRestaurant,
    deleteRestaurant,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    resetMockData,
    getRestaurantById,
    clearError,
  }
})
