import type { Order, OrderItem, OrderStatus } from '@/types/order'
import type { MenuCategory, MenuItem, Restaurant } from '@/types/restaurant'

const STORAGE_KEY = 'easy-eat-mock-db-v1'
const SCHEMA_VERSION = 2

export interface MockDatabase {
  version: number
  seq: {
    order: number
    restaurant: number
    meal: number
    category: number
  }
  categories: MenuCategory[]
  restaurants: Restaurant[]
  orders: Order[]
}

function deepCopy<T>(value: T): T {
  return structuredClone(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toSafeNumber(value: unknown, fallback = 0): number {
  const numberValue = Number(value)
  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : fallback
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function getMaxNumberId(values: string[], prefix: string): number {
  const pattern = new RegExp(String.raw`^${prefix}(\d+)$`)

  return values.reduce((max, current) => {
    const match = pattern.exec(current)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
}

function getDefaultCategories(): MenuCategory[] {
  return [
    { id: 'c1', name: '食物', enabled: true },
    { id: 'c2', name: '飲料', enabled: true },
    { id: 'c3', name: '點心', enabled: true },
    { id: 'c4', name: '套餐', enabled: true },
    { id: 'c5', name: '其他', enabled: true },
  ]
}

function getDefaultRestaurants(): Restaurant[] {
  return [
    {
      id: 'r1',
      name: 'HOT8',
      enabled: true,
      menuItems: [
        { id: 'm1', name: 'Pizza', price: 250, categoryId: 'c1', enabled: true },
        { id: 'm2', name: 'Cola', price: 45, categoryId: 'c2', enabled: true },
        { id: 'm3', name: '薯條', price: 60, categoryId: 'c1', enabled: true },
        { id: 'm4', name: '雞塊', price: 55, categoryId: 'c1', enabled: true },
      ],
    },
    {
      id: 'r2',
      name: '新巴克',
      enabled: true,
      menuItems: [
        { id: 'm5', name: '星冰樂', price: 210, categoryId: 'c2', enabled: true },
        { id: 'm6', name: '拿鐵', price: 150, categoryId: 'c2', enabled: true },
        { id: 'm7', name: '美式', price: 120, categoryId: 'c2', enabled: true },
      ],
    },
    {
      id: 'r3',
      name: '甲上寶',
      enabled: true,
      menuItems: [
        { id: 'm8', name: '蛋餅', price: 50, categoryId: 'c1', enabled: true },
        { id: 'm9', name: '紅茶', price: 25, categoryId: 'c2', enabled: true },
        { id: 'm10', name: '豆漿', price: 25, categoryId: 'c2', enabled: true },
        { id: 'm11', name: '蘿蔔糕', price: 35, categoryId: 'c1', enabled: true },
      ],
    },
    {
      id: 'r4',
      name: '再睡10分鐘',
      enabled: true,
      menuItems: [
        { id: 'm12', name: '珍珠鮮奶茶', price: 80, categoryId: 'c2', enabled: true },
        { id: 'm13', name: '芋頭鮮奶', price: 75, categoryId: 'c2', enabled: true },
        { id: 'm14', name: '波霸綠茶', price: 65, categoryId: 'c2', enabled: true },
      ],
    },
  ]
}

function createDefaultDatabase(): MockDatabase {
  return {
    version: SCHEMA_VERSION,
    seq: {
      order: 0,
      restaurant: 4,
      meal: 14,
      category: 5,
    },
    categories: getDefaultCategories(),
    restaurants: getDefaultRestaurants(),
    orders: [],
  }
}

function normalizeCategories(raw: unknown): MenuCategory[] {
  if (!Array.isArray(raw)) {
    return getDefaultCategories()
  }
  if (raw.length === 0) {
    return []
  }

  const categories = raw.flatMap((value): MenuCategory[] => {
    if (!isRecord(value)) {
      return []
    }

    const id = toStringValue(value.id)
    const name = toStringValue(value.name).trim()
    return id && name ? [{ id, name, enabled: value.enabled !== false }] : []
  })

  return categories.length ? categories : getDefaultCategories()
}

function normalizeOrderItem(raw: unknown): OrderItem | null {
  if (!isRecord(raw)) {
    return null
  }

  const menuItemId = toStringValue(raw.menuItemId)
  const name = toStringValue(raw.name)
  const price = toSafeNumber(raw.price)
  const quantity = toSafeNumber(raw.quantity)
  if (!menuItemId || !name || price <= 0 || quantity <= 0) {
    return null
  }

  return {
    menuItemId,
    name,
    price,
    quantity,
    note: toStringValue(raw.note),
  }
}

function normalizeOrders(raw: unknown): Order[] {
  if (!Array.isArray(raw)) {
    return []
  }

  const validStatuses: OrderStatus[] = ['draft', 'pending', 'completed', 'cancelled']

  return raw.flatMap((value): Order[] => {
    if (!isRecord(value) || !Array.isArray(value.items)) {
      return []
    }

    const items = value.items
      .map(normalizeOrderItem)
      .filter((item): item is OrderItem => item !== null)
    const statusValue = toStringValue(value.status)
    const status = validStatuses.includes(statusValue as OrderStatus)
      ? (statusValue as OrderStatus)
      : 'pending'
    const id = toStringValue(value.id)
    const restaurantId = toStringValue(value.restaurantId)

    if (!id || !restaurantId || !items.length) {
      return []
    }

    return [
      {
        id,
        orderId: toStringValue(value.orderId, id),
        restaurantId,
        restaurantName: toStringValue(value.restaurantName),
        items,
        totalAmount: toSafeNumber(
          value.totalAmount,
          items.reduce((sum, item) => sum + item.price * item.quantity, 0),
        ),
        status,
        createdAt: toStringValue(value.createdAt, new Date().toISOString()),
      },
    ]
  })
}

function normalizeDatabase(raw: unknown): MockDatabase {
  if (!isRecord(raw) || !Array.isArray(raw.restaurants)) {
    return createDefaultDatabase()
  }

  const categories = normalizeCategories(raw.categories)
  let categorySequence = getMaxNumberId(
    categories.map((category) => category.id),
    'c',
  )

  function ensureCategoryId(categoryName: string): string {
    const safeName = categoryName.trim() || '其他'
    const existing = categories.find((category) => category.name === safeName)
    if (existing) {
      return existing.id
    }

    categorySequence += 1
    const category: MenuCategory = {
      id: `c${categorySequence}`,
      name: safeName,
      enabled: true,
    }
    categories.push(category)
    return category.id
  }

  const restaurants = raw.restaurants.flatMap((value): Restaurant[] => {
    if (!isRecord(value) || !Array.isArray(value.menuItems)) {
      return []
    }

    const id = toStringValue(value.id)
    const name = toStringValue(value.name).trim()
    if (!id || !name) {
      return []
    }

    const menuItems = value.menuItems.flatMap((itemValue): MenuItem[] => {
      if (!isRecord(itemValue)) {
        return []
      }

      const itemId = toStringValue(itemValue.id)
      const itemName = toStringValue(itemValue.name).trim()
      const price = toSafeNumber(itemValue.price)
      if (!itemId || !itemName || price <= 0) {
        return []
      }

      const storedCategoryId = toStringValue(itemValue.categoryId)
      const categoryId = categories.some((category) => category.id === storedCategoryId)
        ? storedCategoryId
        : ensureCategoryId(toStringValue(itemValue.category, '其他'))

      return [
        {
          id: itemId,
          name: itemName,
          price,
          categoryId,
          enabled: itemValue.enabled !== false,
        },
      ]
    })

    return [{ id, name, enabled: value.enabled !== false, menuItems }]
  })

  const orders = normalizeOrders(raw.orders)
  const seq = isRecord(raw.seq) ? raw.seq : {}
  const restaurantIds = restaurants.map((restaurant) => restaurant.id)
  const mealIds = restaurants.flatMap((restaurant) => restaurant.menuItems.map((item) => item.id))

  return {
    version: SCHEMA_VERSION,
    seq: {
      order: Math.max(toSafeNumber(seq.order), orders.length),
      restaurant: Math.max(toSafeNumber(seq.restaurant), getMaxNumberId(restaurantIds, 'r')),
      meal: Math.max(toSafeNumber(seq.meal), getMaxNumberId(mealIds, 'm')),
      category: Math.max(toSafeNumber(seq.category), categorySequence),
    },
    categories,
    restaurants,
    orders,
  }
}

export function readDatabase(): MockDatabase {
  const data = localStorage.getItem(STORAGE_KEY)
  if (!data) {
    const defaults = createDefaultDatabase()
    writeDatabase(defaults)
    return deepCopy(defaults)
  }

  try {
    const database = normalizeDatabase(JSON.parse(data))
    writeDatabase(database)
    return deepCopy(database)
  } catch {
    const defaults = createDefaultDatabase()
    writeDatabase(defaults)
    return deepCopy(defaults)
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
