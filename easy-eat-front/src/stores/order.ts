import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { orderService } from '@/services/orderService'
import type { MealStatistic, Order, OrderItem, OrderStatus } from '@/types/order'

export type { Order, OrderItem, OrderStatus } from '@/types/order'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return '發生未知錯誤，請稍後再試'
}

export const useOrderStore = defineStore('order', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const errorMessage = ref<string | null>(null)

  // ── Filter state ────────────────────────────────────────
  const filterStatus = ref<OrderStatus | ''>('')
  const filterRestaurant = ref('')
  const filterDateFrom = ref('')
  const filterDateTo = ref('')

  const filteredOrders = computed(() => {
    return orders.value.filter((order) => {
      if (filterStatus.value && order.status !== filterStatus.value) return false
      if (
        filterRestaurant.value &&
        !order.restaurantName.toLowerCase().includes(filterRestaurant.value.toLowerCase())
      )
        return false
      if (filterDateFrom.value && order.createdAt < filterDateFrom.value) return false
      if (filterDateTo.value && order.createdAt > filterDateTo.value + 'T23:59:59') return false
      return true
    })
  })

  function resetFilters() {
    filterStatus.value = ''
    filterRestaurant.value = ''
    filterDateFrom.value = ''
    filterDateTo.value = ''
  }

  async function initialize(force = false) {
    if (initialized.value && !force) {
      return
    }

    loading.value = true
    errorMessage.value = null

    try {
      orders.value = await orderService.getOrders()
      initialized.value = true
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function createOrder(
    restaurantId: string,
    _restaurantName: string,
    items: OrderItem[],
  ): Promise<Order> {
    loading.value = true
    errorMessage.value = null

    try {
      const order = await orderService.createOrder({
        restaurantId,
        items: orderService.mapOrderItemsToCreateInput(items),
      })
      orders.value.unshift(order)
      return order
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function deleteOrder(id: string) {
    loading.value = true
    errorMessage.value = null

    try {
      await orderService.deleteOrder(id)
      orders.value = orders.value.filter((order) => order.id !== id)
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function updateOrderStatus(id: string, status: OrderStatus): Promise<void> {
    loading.value = true
    errorMessage.value = null

    try {
      const updated = await orderService.updateOrderStatus(id, status)
      const index = orders.value.findIndex((order) => order.id === id)
      if (index !== -1) {
        orders.value[index] = updated
      }
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  function getOrderById(id: string) {
    return orders.value.find((order) => order.id === id)
  }

  const mealStatistics = computed<MealStatistic[]>(() => {
    const statistics: Record<string, MealStatistic> = {}

    for (const order of orders.value) {
      for (const item of order.items) {
        if (!statistics[item.name]) {
          statistics[item.name] = {
            name: item.name,
            price: item.price,
            quantity: 0,
            total: 0,
          }
        }

        statistics[item.name].quantity += item.quantity
        statistics[item.name].total += item.price * item.quantity
      }
    }

    const result: MealStatistic[] = []
    for (const key in statistics) {
      result.push(statistics[key])
    }

    return result.sort((a, b) => b.quantity - a.quantity)
  })

  function clearError() {
    errorMessage.value = null
  }

  return {
    orders,
    loading,
    initialized,
    errorMessage,
    filterStatus,
    filterRestaurant,
    filterDateFrom,
    filterDateTo,
    filteredOrders,
    resetFilters,
    initialize,
    createOrder,
    deleteOrder,
    updateOrderStatus,
    getOrderById,
    mealStatistics,
    clearError,
  }
})
