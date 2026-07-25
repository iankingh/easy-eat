import type { Order } from '@/types/order'
import type { Restaurant } from '@/types/restaurant'

const STORAGE_KEY = 'easy-eat-mock-db-v1'

export interface MockDatabase {
  seq: {
    order: number
    restaurant: number
    meal: number
  }
  restaurants: Restaurant[]
  orders: Order[]
}

function deepCopy<T>(value: T): T {
  return structuredClone(value)
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback
}

function getMaxNumberId(values: string[], prefix: string): number {
  const pattern = new RegExp(String.raw`^${prefix}(\d+)$`)

  return values.reduce((max, current) => {
    const match = pattern.exec(current)
    if (!match) {
      return max
    }
    return Math.max(max, Number(match[1]))
  }, 0)
}

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

function createDefaultDatabase(): MockDatabase {
  return {
    seq: {
      order: 0,
      restaurant: 4,
      meal: 14,
    },
    restaurants: getDefaultRestaurants(),
    orders: [],
  }
}

function normalizeDatabase(raw: unknown): MockDatabase {
  if (!raw || typeof raw !== 'object') {
    return createDefaultDatabase()
  }

  const source = raw as Partial<MockDatabase>
  if (!Array.isArray(source.restaurants) || !Array.isArray(source.orders)) {
    return createDefaultDatabase()
  }

  const restaurants = deepCopy(source.restaurants)
  const orders = deepCopy(source.orders)

  const restaurantIds = restaurants.map((restaurant) => restaurant.id)
  const mealIds: string[] = []

  for (const restaurant of restaurants) {
    for (const item of restaurant.menuItems) {
      mealIds.push(item.id)
    }
  }

  return {
    seq: {
      order: Math.max(toSafeNumber(source.seq?.order), orders.length),
      restaurant: Math.max(toSafeNumber(source.seq?.restaurant), getMaxNumberId(restaurantIds, 'r')),
      meal: Math.max(toSafeNumber(source.seq?.meal), getMaxNumberId(mealIds, 'm')),
    },
    restaurants,
    orders,
  }
}

export function readDatabase(): MockDatabase {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) {
    const defaults = createDefaultDatabase()
    writeDatabase(defaults)
    return defaults
  }

  try {
    return normalizeDatabase(JSON.parse(data))
  } catch {
    const defaults = createDefaultDatabase()
    writeDatabase(defaults)
    return defaults
  }
}

export function writeDatabase(database: MockDatabase): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database))
}

export function resetDatabase(): MockDatabase {
  const defaults = createDefaultDatabase()
  writeDatabase(defaults)
  return deepCopy(defaults)
}
