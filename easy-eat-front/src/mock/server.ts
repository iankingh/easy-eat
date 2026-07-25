import {
  readDatabase,
  resetDatabase,
  type MockDatabase,
  writeDatabase,
} from '@/mock/db'
import type {
  CreateOrderInput,
  MealStatistic,
  Order,
  OrderItem,
  OrderStatus,
  UpdateOrderStatusInput,
} from '@/types/order'
import type {
  MenuItem,
  MenuItemInput,
  Restaurant,
  RestaurantInput,
} from '@/types/restaurant'

const MOCK_LATENCY_MS = 180

function deepCopy<T>(value: T): T {
  return structuredClone(value)
}

function withLatency<T>(value: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(deepCopy(value)), MOCK_LATENCY_MS)
  })
}

function saveAndReply<T>(database: MockDatabase, value: T): Promise<T> {
  writeDatabase(database)
  return withLatency(value)
}

function requireRestaurant(database: MockDatabase, restaurantId: string): Restaurant {
  const restaurant = database.restaurants.find((item) => item.id === restaurantId)
  if (!restaurant) {
    throw new Error('找不到餐廳資料')
  }
  return restaurant
}

function requireMenuItem(restaurant: Restaurant, menuItemId: string): MenuItem {
  const menuItem = restaurant.menuItems.find((item) => item.id === menuItemId)
  if (!menuItem) {
    throw new Error('找不到餐點資料')
  }
  return menuItem
}

function leftPadNumber(value: number, size: number): string {
  const base = String(value)
  if (base.length >= size) {
    return base
  }
  return `${'0'.repeat(size)}${base}`.slice(-size)
}

function buildOrderId(sequence: number): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replaceAll('-', '')
  const hours = leftPadNumber(now.getHours(), 2)
  const minutes = leftPadNumber(now.getMinutes(), 2)
  const seconds = leftPadNumber(now.getSeconds(), 2)
  const sequenceText = leftPadNumber(sequence, 5)

  return `${date}-${hours}${minutes}${seconds}-${sequenceText}`
}

function normalizePrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('價格必須為大於 0 的數字')
  }
  return Math.round(value)
}

function normalizeQuantity(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error('數量必須為大於 0 的數字')
  }
  return Math.round(value)
}

export async function listOrders(): Promise<Order[]> {
  const database = readDatabase()
  const orders = [...database.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return withLatency(orders)
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const database = readDatabase()
  const order = database.orders.find((item) => item.id === orderId) ?? null
  return withLatency(order)
}

export async function createOrder(payload: CreateOrderInput): Promise<Order> {
  if (!payload.restaurantId) {
    throw new Error('請選擇餐廳')
  }

  if (!payload.items.length) {
    throw new Error('請至少選擇一項餐點')
  }

  const database = readDatabase()
  const restaurant = requireRestaurant(database, payload.restaurantId)

  const items: OrderItem[] = payload.items.map((item) => {
    const menuItem = requireMenuItem(restaurant, item.menuItemId)

    return {
      menuItemId: item.menuItemId,
      name: menuItem.name,
      price: menuItem.price,
      quantity: normalizeQuantity(item.quantity),
      note: item.note?.trim() ?? '',
    }
  })

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  database.seq.order += 1

  const order: Order = {
    id: `o${Date.now()}${database.seq.order}`,
    orderId: buildOrderId(database.seq.order),
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    items,
    totalAmount,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }

  database.orders.unshift(order)

  return saveAndReply(database, order)
}

export async function deleteOrder(orderId: string): Promise<void> {
  const database = readDatabase()
  database.orders = database.orders.filter((item) => item.id !== orderId)
  await saveAndReply(database, null)
}

export async function updateOrderStatus(
  orderId: string,
  payload: UpdateOrderStatusInput,
): Promise<Order> {
  const validStatuses: OrderStatus[] = ['pending', 'completed', 'cancelled']
  if (!validStatuses.includes(payload.status)) {
    throw new Error('無效的訂單狀態')
  }

  const database = readDatabase()
  const order = database.orders.find((item) => item.id === orderId)
  if (!order) {
    throw new Error('找不到訂單資料')
  }

  order.status = payload.status
  return saveAndReply(database, order)
}

export async function listMealStatistics(): Promise<MealStatistic[]> {
  const database = readDatabase()
  const statisticsMap = new Map<string, MealStatistic>()

  for (const order of database.orders) {
    for (const item of order.items) {
      const current = statisticsMap.get(item.name)
      if (!current) {
        statisticsMap.set(item.name, {
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          total: item.price * item.quantity,
        })
        continue
      }

      current.quantity += item.quantity
      current.total += item.price * item.quantity
    }
  }

  const statistics = [...statisticsMap.values()].sort((a, b) => b.quantity - a.quantity)
  return withLatency(statistics)
}

export async function listRestaurants(): Promise<Restaurant[]> {
  const database = readDatabase()
  return withLatency(database.restaurants)
}

export async function createRestaurant(payload: RestaurantInput): Promise<Restaurant> {
  const name = payload.name?.trim()
  if (!name) {
    throw new Error('餐廳名稱不可為空')
  }

  const database = readDatabase()
  database.seq.restaurant += 1

  const restaurant: Restaurant = {
    id: `r${database.seq.restaurant}`,
    name,
    menuItems: [],
  }

  database.restaurants.push(restaurant)

  return saveAndReply(database, restaurant)
}

export async function updateRestaurant(
  restaurantId: string,
  payload: RestaurantInput,
): Promise<Restaurant> {
  const name = payload.name?.trim()
  if (!name) {
    throw new Error('餐廳名稱不可為空')
  }

  const database = readDatabase()
  const restaurant = requireRestaurant(database, restaurantId)
  restaurant.name = name

  return saveAndReply(database, restaurant)
}

export async function deleteRestaurant(restaurantId: string): Promise<void> {
  const database = readDatabase()
  database.restaurants = database.restaurants.filter((item) => item.id !== restaurantId)
  await saveAndReply(database, null)
}

export async function createMenuItem(
  restaurantId: string,
  payload: MenuItemInput,
): Promise<MenuItem> {
  const name = payload.name?.trim()
  if (!name) {
    throw new Error('餐點名稱不可為空')
  }

  const database = readDatabase()
  const restaurant = requireRestaurant(database, restaurantId)

  database.seq.meal += 1

  const menuItem: MenuItem = {
    id: `m${database.seq.meal}`,
    name,
    price: normalizePrice(payload.price),
    category: payload.category || '其他',
  }

  restaurant.menuItems.push(menuItem)

  return saveAndReply(database, menuItem)
}

export async function updateMenuItem(
  restaurantId: string,
  menuItemId: string,
  payload: MenuItemInput,
): Promise<MenuItem> {
  const name = payload.name?.trim()
  if (!name) {
    throw new Error('餐點名稱不可為空')
  }

  const database = readDatabase()
  const restaurant = requireRestaurant(database, restaurantId)
  const menuItem = requireMenuItem(restaurant, menuItemId)

  menuItem.name = name
  menuItem.price = normalizePrice(payload.price)
  menuItem.category = payload.category || '其他'

  return saveAndReply(database, menuItem)
}

export async function deleteMenuItem(restaurantId: string, menuItemId: string): Promise<void> {
  const database = readDatabase()
  const restaurant = requireRestaurant(database, restaurantId)
  restaurant.menuItems = restaurant.menuItems.filter((item) => item.id !== menuItemId)
  await saveAndReply(database, null)
}

export async function resetMockServerData(): Promise<void> {
  resetDatabase()
  await withLatency(null)
}
