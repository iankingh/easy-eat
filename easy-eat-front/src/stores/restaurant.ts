import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface MenuItem {
  id: string
  name: string
  price: number
  category: string
}

export interface Restaurant {
  id: string
  name: string
  menuItems: MenuItem[]
}

const STORAGE_KEY = 'easy-eat-restaurants'

function getDefaultRestaurants(): Restaurant[] {
  return [
    {
      id: 'r1',
      name: 'HOT8',
      menuItems: [
        { id: 'm1', name: 'Pizza', price: 250, category: '食物' },
        { id: 'm2', name: 'Cola', price: 45, category: '飲料' },
        { id: 'm3', name: '薯條', price: 60, category: '食物' },
        { id: 'm4', name: '雞塊', price: 55, category: '食物' },
      ],
    },
    {
      id: 'r2',
      name: '新巴克',
      menuItems: [
        { id: 'm5', name: '星冰樂', price: 210, category: '飲料' },
        { id: 'm6', name: '拿鐵', price: 150, category: '飲料' },
        { id: 'm7', name: '美式', price: 120, category: '飲料' },
      ],
    },
    {
      id: 'r3',
      name: '甲上寶',
      menuItems: [
        { id: 'm8', name: '蛋餅', price: 50, category: '食物' },
        { id: 'm9', name: '紅茶', price: 25, category: '飲料' },
        { id: 'm10', name: '豆漿', price: 25, category: '飲料' },
        { id: 'm11', name: '蘿蔔糕', price: 35, category: '食物' },
      ],
    },
    {
      id: 'r4',
      name: '再睡10分鐘',
      menuItems: [
        { id: 'm12', name: '珍珠鮮奶茶', price: 80, category: '飲料' },
        { id: 'm13', name: '芋頭鮮奶', price: 75, category: '飲料' },
        { id: 'm14', name: '波霸綠茶', price: 65, category: '飲料' },
      ],
    },
  ]
}

export const useRestaurantStore = defineStore('restaurant', () => {
  const restaurants = ref<Restaurant[]>(loadFromStorage())

  function loadFromStorage(): Restaurant[] {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      try {
        return JSON.parse(data)
      } catch {
        return getDefaultRestaurants()
      }
    }
    const defaults = getDefaultRestaurants()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
    return defaults
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(restaurants.value))
  }

  function addRestaurant(name: string): Restaurant {
    const restaurant: Restaurant = {
      id: `r-${Date.now()}`,
      name,
      menuItems: [],
    }
    restaurants.value.push(restaurant)
    save()
    return restaurant
  }

  function updateRestaurant(id: string, name: string) {
    const r = restaurants.value.find((r) => r.id === id)
    if (r) {
      r.name = name
      save()
    }
  }

  function deleteRestaurant(id: string) {
    restaurants.value = restaurants.value.filter((r) => r.id !== id)
    save()
  }

  function addMenuItem(restaurantId: string, item: Omit<MenuItem, 'id'>) {
    const r = restaurants.value.find((r) => r.id === restaurantId)
    if (r) {
      r.menuItems.push({ ...item, id: `m-${Date.now()}` })
      save()
    }
  }

  function updateMenuItem(restaurantId: string, itemId: string, data: Omit<MenuItem, 'id'>) {
    const r = restaurants.value.find((r) => r.id === restaurantId)
    if (r) {
      const item = r.menuItems.find((m) => m.id === itemId)
      if (item) {
        Object.assign(item, data)
        save()
      }
    }
  }

  function deleteMenuItem(restaurantId: string, itemId: string) {
    const r = restaurants.value.find((r) => r.id === restaurantId)
    if (r) {
      r.menuItems = r.menuItems.filter((m) => m.id !== itemId)
      save()
    }
  }

  function getRestaurantById(id: string) {
    return restaurants.value.find((r) => r.id === id)
  }

  return {
    restaurants,
    addRestaurant,
    updateRestaurant,
    deleteRestaurant,
    addMenuItem,
    updateMenuItem,
    deleteMenuItem,
    getRestaurantById,
  }
})
