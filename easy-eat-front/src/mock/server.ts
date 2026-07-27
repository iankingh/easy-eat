import { ORDER_STATUS_TRANSITIONS } from '@/constants/order'
import { readDatabase, resetDatabase, type MockDatabase, writeDatabase } from '@/mock/db'
import type {
  CreateOrderInput,
  EditableOrderStatus,
  MealStatistic,
  Order,
  OrderItem,
  OrderStatus,
  UpdateOrderInput,
  UpdateOrderStatusInput,
} from '@/types/order'
import type {
  MenuCategory,
  MenuCategoryInput,
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

function requireCategory(database: MockDatabase, categoryId: string): MenuCategory {
  const category = database.categories.find((item) => item.id === categoryId)
  if (!category) {
    throw new Error('找不到餐點分類')
  }
  return category
}

function requireOrder(database: MockDatabase, orderId: string): Order {
  const order = database.orders.find((item) => item.id === orderId)
  if (!order) {
    throw new Error('找不到訂單資料')
  }
  return order
}

function leftPadNumber(value: number, size: number): string {
  return String(value).padStart(size, '0')
}

function buildOrderId(sequence: number): string {
  const now = new Date()
  const date = [
    now.getFullYear(),
    leftPadNumber(now.getMonth() + 1, 2),
    leftPadNumber(now.getDate(), 2),
  ].join('')
  const time = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((value) => leftPadNumber(value, 2))
    .join('')

  return `${date}-${time}-${leftPadNumber(sequence, 5)}`
}

function normalizePrice(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('價格必須為大於 0 的整數')
  }
  return value
}

function normalizeQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error('數量必須為大於 0 的整數')
  }
  return value
}

function buildOrderItems(
  database: MockDatabase,
  restaurantId: string,
  payload: CreateOrderInput | UpdateOrderInput,
): { restaurant: Restaurant; items: OrderItem[] } {
  if (!restaurantId) {
    throw new Error('請選擇餐廳')
  }
  if (!payload.items.length) {
    throw new Error('請至少選擇一項餐點')
  }

  const restaurant = requireRestaurant(database, restaurantId)
  if (!restaurant.enabled) {
    throw new Error('此餐廳目前未啟用')
  }

  const seenIds = new Set<string>()
  const items = payload.items.map((item) => {
    if (seenIds.has(item.menuItemId)) {
      throw new Error('同一餐點不可重複加入訂單')
    }
    seenIds.add(item.menuItemId)

    const menuItem = requireMenuItem(restaurant, item.menuItemId)
    const category = requireCategory(database, menuItem.categoryId)
    if (!menuItem.enabled || !category.enabled) {
      throw new Error(`餐點「${menuItem.name}」目前未啟用`)
    }

    return {
      menuItemId: item.menuItemId,
      name: menuItem.name,
      price: menuItem.price,
      quantity: normalizeQuantity(item.quantity),
      note: item.note?.trim() ?? '',
    }
  })

  return { restaurant, items }
}

export async function listOrders(): Promise<Order[]> {
  const database = readDatabase()
  const orders = [...database.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return withLatency(orders)
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const database = readDatabase()
  return withLatency(database.orders.find((item) => item.id === orderId) ?? null)
}

export async function createOrder(
  payload: CreateOrderInput,
  status: EditableOrderStatus = 'pending',
): Promise<Order> {
  const database = readDatabase()
  const { restaurant, items } = buildOrderItems(database, payload.restaurantId, payload)
  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  database.seq.order += 1
  const order: Order = {
    id: `o${Date.now()}${database.seq.order}`,
    orderId: buildOrderId(database.seq.order),
    restaurantId: restaurant.id,
    restaurantName: restaurant.name,
    items,
    totalAmount,
    status,
    createdAt: new Date().toISOString(),
  }

  database.orders.unshift(order)
  return saveAndReply(database, order)
}

export async function updateOrder(orderId: string, payload: UpdateOrderInput): Promise<Order> {
  const database = readDatabase()
  const order = requireOrder(database, orderId)
  if (order.status !== 'draft' && order.status !== 'pending') {
    throw new Error('只有草稿或處理中的訂單可以編輯')
  }

  const { restaurant, items } = buildOrderItems(database, payload.restaurantId, payload)
  order.restaurantId = restaurant.id
  order.restaurantName = restaurant.name
  order.items = items
  order.totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return saveAndReply(database, order)
}

export async function submitOrder(orderId: string): Promise<Order> {
  const database = readDatabase()
  const order = requireOrder(database, orderId)
  if (order.status !== 'draft') {
    throw new Error('只有草稿訂單可以送出')
  }

  const { restaurant, items } = buildOrderItems(database, order.restaurantId, {
    restaurantId: order.restaurantId,
    items: order.items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      note: item.note,
    })),
  })
  order.restaurantName = restaurant.name
  order.items = items
  order.totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  order.status = 'pending'
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
  const database = readDatabase()
  const order = requireOrder(database, orderId)
  const validStatuses: OrderStatus[] = ['draft', 'pending', 'completed', 'cancelled']
  if (!validStatuses.includes(payload.status)) {
    throw new Error('無效的訂單狀態')
  }
  if (!ORDER_STATUS_TRANSITIONS[order.status].includes(payload.status)) {
    throw new Error('不允許此訂單狀態轉換')
  }

  order.status = payload.status
  return saveAndReply(database, order)
}

export async function listMealStatistics(): Promise<MealStatistic[]> {
  const database = readDatabase()
  const statisticsMap = new Map<string, MealStatistic>()

  for (const order of database.orders) {
    if (order.status === 'draft' || order.status === 'cancelled') {
      continue
    }

    for (const item of order.items) {
      const key = `${item.name}:${item.price}`
      const current = statisticsMap.get(key)
      if (!current) {
        statisticsMap.set(key, {
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

  return withLatency(
    [...statisticsMap.values()].sort(
      (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'zh-TW'),
    ),
  )
}

export async function listRestaurants(): Promise<Restaurant[]> {
  return withLatency(readDatabase().restaurants)
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
    enabled: true,
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

export async function setRestaurantEnabled(
  restaurantId: string,
  enabled: boolean,
): Promise<Restaurant> {
  const database = readDatabase()
  const restaurant = requireRestaurant(database, restaurantId)
  restaurant.enabled = enabled
  return saveAndReply(database, restaurant)
}

export async function deleteRestaurant(restaurantId: string): Promise<void> {
  const database = readDatabase()
  if (
    database.orders.some(
      (order) =>
        order.restaurantId === restaurantId &&
        (order.status === 'draft' || order.status === 'pending'),
    )
  ) {
    throw new Error('此餐廳仍有草稿或處理中的訂單，無法刪除')
  }

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
  requireCategory(database, payload.categoryId)
  database.seq.meal += 1

  const menuItem: MenuItem = {
    id: `m${database.seq.meal}`,
    name,
    price: normalizePrice(payload.price),
    categoryId: payload.categoryId,
    enabled: true,
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
  requireCategory(database, payload.categoryId)

  menuItem.name = name
  menuItem.price = normalizePrice(payload.price)
  menuItem.categoryId = payload.categoryId
  return saveAndReply(database, menuItem)
}

export async function setMenuItemEnabled(
  restaurantId: string,
  menuItemId: string,
  enabled: boolean,
): Promise<MenuItem> {
  const database = readDatabase()
  const restaurant = requireRestaurant(database, restaurantId)
  const menuItem = requireMenuItem(restaurant, menuItemId)
  menuItem.enabled = enabled
  return saveAndReply(database, menuItem)
}

export async function deleteMenuItem(restaurantId: string, menuItemId: string): Promise<void> {
  const database = readDatabase()
  const restaurant = requireRestaurant(database, restaurantId)
  if (
    database.orders.some(
      (order) =>
        (order.status === 'draft' || order.status === 'pending') &&
        order.items.some((item) => item.menuItemId === menuItemId),
    )
  ) {
    throw new Error('此餐點仍在草稿或處理中的訂單內，無法刪除')
  }

  restaurant.menuItems = restaurant.menuItems.filter((item) => item.id !== menuItemId)
  await saveAndReply(database, null)
}

export async function listCategories(): Promise<MenuCategory[]> {
  return withLatency(readDatabase().categories)
}

export async function createCategory(payload: MenuCategoryInput): Promise<MenuCategory> {
  const name = payload.name?.trim()
  if (!name) {
    throw new Error('分類名稱不可為空')
  }

  const database = readDatabase()
  if (database.categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
    throw new Error('分類名稱不可重複')
  }

  database.seq.category += 1
  const category: MenuCategory = {
    id: `c${database.seq.category}`,
    name,
    enabled: true,
  }
  database.categories.push(category)
  return saveAndReply(database, category)
}

export async function updateCategory(
  categoryId: string,
  payload: MenuCategoryInput,
): Promise<MenuCategory> {
  const name = payload.name?.trim()
  if (!name) {
    throw new Error('分類名稱不可為空')
  }

  const database = readDatabase()
  const category = requireCategory(database, categoryId)
  if (
    database.categories.some(
      (item) => item.id !== categoryId && item.name.toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new Error('分類名稱不可重複')
  }

  category.name = name
  return saveAndReply(database, category)
}

export async function setCategoryEnabled(
  categoryId: string,
  enabled: boolean,
): Promise<MenuCategory> {
  const database = readDatabase()
  const category = requireCategory(database, categoryId)
  category.enabled = enabled
  return saveAndReply(database, category)
}

export async function deleteCategory(categoryId: string): Promise<void> {
  const database = readDatabase()
  requireCategory(database, categoryId)
  if (
    database.restaurants.some((restaurant) =>
      restaurant.menuItems.some((item) => item.categoryId === categoryId),
    )
  ) {
    throw new Error('此分類仍有餐點使用，無法刪除')
  }

  database.categories = database.categories.filter((item) => item.id !== categoryId)
  await saveAndReply(database, null)
}

export async function resetMockServerData(): Promise<void> {
  resetDatabase()
  await withLatency(null)
}
