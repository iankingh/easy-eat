import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface OrderItem {
  menuItemId: string
  name: string
  price: number
  quantity: number
  note: string
}

export interface Order {
  id: string
  orderId: string
  restaurantId: string
  restaurantName: string
  items: OrderItem[]
  totalAmount: number
  createdAt: string
}

const STORAGE_KEY = 'easy-eat-orders'
const SEQ_KEY = 'easy-eat-order-seq'

function generateOrderId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const time = `${hours}${minutes}${seconds}`
  const seq = parseInt(localStorage.getItem(SEQ_KEY) || '0') + 1
  localStorage.setItem(SEQ_KEY, String(seq))
  return `${date}-${time}-${String(seq).padStart(5, '0')}`
}

export const useOrderStore = defineStore('order', () => {
  const orders = ref<Order[]>(loadFromStorage())

  function loadFromStorage(): Order[] {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      try {
        return JSON.parse(data)
      } catch {
        return []
      }
    }
    return []
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders.value))
  }

  function createOrder(
    restaurantId: string,
    restaurantName: string,
    items: OrderItem[],
  ): Order {
    const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
    const order: Order = {
      id: String(Date.now()),
      orderId: generateOrderId(),
      restaurantId,
      restaurantName,
      items,
      totalAmount,
      createdAt: new Date().toISOString(),
    }
    orders.value.unshift(order)
    save()
    return order
  }

  function deleteOrder(id: string) {
    orders.value = orders.value.filter((o) => o.id !== id)
    save()
  }

  function getOrderById(id: string) {
    return orders.value.find((o) => o.id === id)
  }

  const mealStatistics = computed(() => {
    const stats: Record<string, { name: string; price: number; quantity: number; total: number }> =
      {}
    for (const order of orders.value) {
      for (const item of order.items) {
        if (!stats[item.name]) {
          stats[item.name] = { name: item.name, price: item.price, quantity: 0, total: 0 }
        }
        stats[item.name].quantity += item.quantity
        stats[item.name].total += item.price * item.quantity
      }
    }
    return Object.values(stats).sort((a, b) => b.quantity - a.quantity)
  })

  return {
    orders,
    createOrder,
    deleteOrder,
    getOrderById,
    mealStatistics,
  }
})
