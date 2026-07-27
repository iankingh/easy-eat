import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { restaurantService } from '@/services/restaurantService'
import type { MenuCategory, MenuItem, MenuItemInput, Restaurant } from '@/types/restaurant'
import { getErrorMessage } from '@/utils/error'

export type { MenuCategory, MenuItem, Restaurant } from '@/types/restaurant'

export type RestaurantSortKey = 'name' | 'enabled'

export const useRestaurantStore = defineStore('restaurant', () => {
  const restaurants = ref<Restaurant[]>([])
  const categories = ref<MenuCategory[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const errorMessage = ref<string | null>(null)
  const searchQuery = ref('')
  const sortBy = ref<RestaurantSortKey>('name')
  const sortDirection = ref<'asc' | 'desc'>('asc')

  const activeCategories = computed(() => categories.value.filter((category) => category.enabled))
  const activeRestaurants = computed(() =>
    restaurants.value
      .filter((restaurant) => restaurant.enabled)
      .map((restaurant) => ({
        ...restaurant,
        menuItems: restaurant.menuItems.filter(
          (item) =>
            item.enabled &&
            categories.value.some(
              (category) => category.id === item.categoryId && category.enabled,
            ),
        ),
      })),
  )

  const filteredRestaurants = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    const direction = sortDirection.value === 'asc' ? 1 : -1

    return restaurants.value
      .filter(
        (restaurant) =>
          !query ||
          restaurant.name.toLowerCase().includes(query) ||
          restaurant.menuItems.some((item) => item.name.toLowerCase().includes(query)),
      )
      .sort((left, right) => {
        if (sortBy.value === 'enabled') {
          return (Number(left.enabled) - Number(right.enabled)) * direction
        }
        return left.name.localeCompare(right.name, 'zh-TW') * direction
      })
  })

  async function initialize(force = false) {
    if (initialized.value && !force) {
      return
    }

    loading.value = true
    errorMessage.value = null
    try {
      const [restaurantList, categoryList] = await Promise.all([
        restaurantService.getRestaurants(),
        restaurantService.getCategories(),
      ])
      restaurants.value = restaurantList
      categories.value = categoryList
      initialized.value = true
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function runMutation<T>(operation: () => Promise<T>): Promise<T> {
    loading.value = true
    errorMessage.value = null
    try {
      return await operation()
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function addRestaurant(name: string): Promise<Restaurant> {
    const safeName = requireName(name, '餐廳名稱不可為空')
    return runMutation(async () => {
      const restaurant = await restaurantService.createRestaurant({ name: safeName })
      restaurants.value.push(restaurant)
      return restaurant
    })
  }

  async function updateRestaurant(id: string, name: string): Promise<Restaurant> {
    const safeName = requireName(name, '餐廳名稱不可為空')
    return runMutation(async () => {
      const updated = await restaurantService.updateRestaurant(id, { name: safeName })
      replaceRestaurant(updated)
      return updated
    })
  }

  async function setRestaurantEnabled(id: string, enabled: boolean): Promise<Restaurant> {
    return runMutation(async () => {
      const updated = await restaurantService.setRestaurantEnabled(id, enabled)
      replaceRestaurant(updated)
      return updated
    })
  }

  async function deleteRestaurant(id: string) {
    return runMutation(async () => {
      await restaurantService.deleteRestaurant(id)
      restaurants.value = restaurants.value.filter((restaurant) => restaurant.id !== id)
    })
  }

  async function addMenuItem(restaurantId: string, item: MenuItemInput): Promise<MenuItem> {
    const payload = normalizeMenuItemInput(item)
    return runMutation(async () => {
      const created = await restaurantService.createMenuItem(restaurantId, payload)
      requireRestaurantInStore(restaurantId).menuItems.push(created)
      return created
    })
  }

  async function updateMenuItem(
    restaurantId: string,
    itemId: string,
    data: MenuItemInput,
  ): Promise<MenuItem> {
    const payload = normalizeMenuItemInput(data)
    return runMutation(async () => {
      const updated = await restaurantService.updateMenuItem(restaurantId, itemId, payload)
      replaceMenuItem(restaurantId, updated)
      return updated
    })
  }

  async function setMenuItemEnabled(
    restaurantId: string,
    itemId: string,
    enabled: boolean,
  ): Promise<MenuItem> {
    return runMutation(async () => {
      const updated = await restaurantService.setMenuItemEnabled(restaurantId, itemId, enabled)
      replaceMenuItem(restaurantId, updated)
      return updated
    })
  }

  async function deleteMenuItem(restaurantId: string, itemId: string) {
    return runMutation(async () => {
      await restaurantService.deleteMenuItem(restaurantId, itemId)
      const restaurant = requireRestaurantInStore(restaurantId)
      restaurant.menuItems = restaurant.menuItems.filter((item) => item.id !== itemId)
    })
  }

  async function addCategory(name: string): Promise<MenuCategory> {
    const safeName = requireName(name, '分類名稱不可為空')
    return runMutation(async () => {
      const category = await restaurantService.createCategory({ name: safeName })
      categories.value.push(category)
      return category
    })
  }

  async function updateCategory(id: string, name: string): Promise<MenuCategory> {
    const safeName = requireName(name, '分類名稱不可為空')
    return runMutation(async () => {
      const updated = await restaurantService.updateCategory(id, { name: safeName })
      replaceCategory(updated)
      return updated
    })
  }

  async function setCategoryEnabled(id: string, enabled: boolean): Promise<MenuCategory> {
    return runMutation(async () => {
      const updated = await restaurantService.setCategoryEnabled(id, enabled)
      replaceCategory(updated)
      return updated
    })
  }

  async function deleteCategory(id: string) {
    return runMutation(async () => {
      await restaurantService.deleteCategory(id)
      categories.value = categories.value.filter((category) => category.id !== id)
    })
  }

  async function resetMockData() {
    return runMutation(async () => {
      await restaurantService.resetMockData()
      initialized.value = false
      await initialize(true)
    })
  }

  function requireName(value: string, message: string): string {
    const safeValue = value.trim()
    if (!safeValue) {
      throw new Error(message)
    }
    return safeValue
  }

  function normalizeMenuItemInput(item: MenuItemInput): MenuItemInput {
    const name = requireName(item.name, '餐點名稱不可為空')
    if (!Number.isInteger(item.price) || item.price <= 0) {
      throw new Error('價格必須為大於 0 的整數')
    }
    if (!categories.value.some((category) => category.id === item.categoryId)) {
      throw new Error('請選擇有效的餐點分類')
    }
    return { ...item, name }
  }

  function requireRestaurantInStore(id: string): Restaurant {
    const restaurant = restaurants.value.find((item) => item.id === id)
    if (!restaurant) {
      throw new Error('找不到餐廳資料')
    }
    return restaurant
  }

  function replaceRestaurant(updated: Restaurant) {
    const index = restaurants.value.findIndex((item) => item.id === updated.id)
    if (index === -1) {
      restaurants.value.push(updated)
      return
    }
    restaurants.value[index] = updated
  }

  function replaceMenuItem(restaurantId: string, updated: MenuItem) {
    const restaurant = requireRestaurantInStore(restaurantId)
    const index = restaurant.menuItems.findIndex((item) => item.id === updated.id)
    if (index === -1) {
      restaurant.menuItems.push(updated)
      return
    }
    restaurant.menuItems[index] = updated
  }

  function replaceCategory(updated: MenuCategory) {
    const index = categories.value.findIndex((item) => item.id === updated.id)
    if (index === -1) {
      categories.value.push(updated)
      return
    }
    categories.value[index] = updated
  }

  function getRestaurantById(id: string) {
    return restaurants.value.find((restaurant) => restaurant.id === id)
  }

  function getCategoryById(id: string) {
    return categories.value.find((category) => category.id === id)
  }

  function clearError() {
    errorMessage.value = null
  }

  return {
    restaurants,
    categories,
    loading,
    initialized,
    errorMessage,
    searchQuery,
    sortBy,
    sortDirection,
    activeCategories,
    activeRestaurants,
    filteredRestaurants,
    initialize,
    addRestaurant,
    updateRestaurant,
    setRestaurantEnabled,
    deleteRestaurant,
    addMenuItem,
    updateMenuItem,
    setMenuItemEnabled,
    deleteMenuItem,
    addCategory,
    updateCategory,
    setCategoryEnabled,
    deleteCategory,
    resetMockData,
    getRestaurantById,
    getCategoryById,
    clearError,
  }
})
