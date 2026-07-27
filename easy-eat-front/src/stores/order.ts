import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { DEFAULT_PAGE_SIZE } from '@/constants/order'
import { orderService } from '@/services/orderService'
import type {
  EditableOrderStatus,
  MealStatistic,
  Order,
  OrderItem,
  OrderStatus,
} from '@/types/order'
import { getErrorMessage } from '@/utils/error'

export type { Order, OrderItem, OrderStatus } from '@/types/order'

export type OrderSortKey = 'createdAt' | 'totalAmount' | 'status' | 'restaurantName'
export type SortDirection = 'asc' | 'desc'

export const useOrderStore = defineStore('order', () => {
  const orders = ref<Order[]>([])
  const loading = ref(false)
  const initialized = ref(false)
  const errorMessage = ref<string | null>(null)

  const searchQuery = ref('')
  const filterStatus = ref<OrderStatus | ''>('')
  const filterRestaurant = ref('')
  const filterDateFrom = ref('')
  const filterDateTo = ref('')
  const sortBy = ref<OrderSortKey>('createdAt')
  const sortDirection = ref<SortDirection>('desc')
  const currentPage = ref(1)
  const pageSize = ref(DEFAULT_PAGE_SIZE)

  const filteredOrders = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()

    return orders.value.filter((order) => {
      const localCreatedDate = toLocalDateKey(order.createdAt)
      if (filterStatus.value && order.status !== filterStatus.value) return false
      if (
        filterRestaurant.value &&
        !order.restaurantName.toLowerCase().includes(filterRestaurant.value.toLowerCase())
      ) {
        return false
      }
      if (filterDateFrom.value && localCreatedDate < filterDateFrom.value) return false
      if (filterDateTo.value && localCreatedDate > filterDateTo.value) return false
      if (
        query &&
        ![
          order.orderId,
          order.restaurantName,
          ...order.items.flatMap((item) => [item.name, item.note]),
        ].some((value) => value.toLowerCase().includes(query))
      ) {
        return false
      }
      return true
    })
  })

  const sortedOrders = computed(() => {
    const direction = sortDirection.value === 'asc' ? 1 : -1

    return [...filteredOrders.value].sort((left, right) => {
      const leftValue = left[sortBy.value]
      const rightValue = right[sortBy.value]
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return (leftValue - rightValue) * direction
      }
      return String(leftValue).localeCompare(String(rightValue), 'zh-TW') * direction
    })
  })

  const totalPages = computed(() =>
    Math.max(1, Math.ceil(sortedOrders.value.length / pageSize.value)),
  )

  const paginatedOrders = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    return sortedOrders.value.slice(start, start + pageSize.value)
  })

  watch(
    [
      searchQuery,
      filterStatus,
      filterRestaurant,
      filterDateFrom,
      filterDateTo,
      sortBy,
      sortDirection,
    ],
    () => {
      currentPage.value = 1
    },
  )

  watch(totalPages, (value) => {
    if (currentPage.value > value) {
      currentPage.value = value
    }
  })

  function resetFilters() {
    searchQuery.value = ''
    filterStatus.value = ''
    filterRestaurant.value = ''
    filterDateFrom.value = ''
    filterDateTo.value = ''
    sortBy.value = 'createdAt'
    sortDirection.value = 'desc'
    currentPage.value = 1
  }

  function toLocalDateKey(timestamp: string): string {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
      return ''
    }

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
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
    items: OrderItem[],
    status: EditableOrderStatus = 'pending',
  ): Promise<Order> {
    loading.value = true
    errorMessage.value = null
    try {
      const order = await orderService.createOrder(
        {
          restaurantId,
          items: orderService.mapOrderItemsToCreateInput(items),
        },
        status,
      )
      orders.value.unshift(order)
      return order
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  function saveDraft(restaurantId: string, items: OrderItem[]): Promise<Order> {
    return createOrder(restaurantId, items, 'draft')
  }

  async function updateOrder(id: string, restaurantId: string, items: OrderItem[]): Promise<Order> {
    loading.value = true
    errorMessage.value = null
    try {
      const updated = await orderService.updateOrder(id, {
        restaurantId,
        items: orderService.mapOrderItemsToCreateInput(items),
      })
      replaceOrder(updated)
      return updated
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  async function submitDraft(id: string): Promise<Order> {
    loading.value = true
    errorMessage.value = null
    try {
      const updated = await orderService.submitOrder(id)
      replaceOrder(updated)
      return updated
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
      replaceOrder(await orderService.updateOrderStatus(id, status))
    } catch (error) {
      errorMessage.value = getErrorMessage(error)
      throw error
    } finally {
      loading.value = false
    }
  }

  function replaceOrder(updated: Order) {
    const index = orders.value.findIndex((order) => order.id === updated.id)
    if (index === -1) {
      orders.value.unshift(updated)
      return
    }
    orders.value[index] = updated
  }

  function getOrderById(id: string) {
    return orders.value.find((order) => order.id === id)
  }

  const mealStatistics = computed<MealStatistic[]>(() => {
    const statistics = new Map<string, MealStatistic>()

    for (const order of orders.value) {
      if (order.status === 'draft' || order.status === 'cancelled') {
        continue
      }
      for (const item of order.items) {
        const key = `${item.name}:${item.price}`
        const current = statistics.get(key) ?? {
          name: item.name,
          price: item.price,
          quantity: 0,
          total: 0,
        }
        current.quantity += item.quantity
        current.total += item.price * item.quantity
        statistics.set(key, current)
      }
    }

    return [...statistics.values()].sort(
      (a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'zh-TW'),
    )
  })

  function clearError() {
    errorMessage.value = null
  }

  return {
    orders,
    loading,
    initialized,
    errorMessage,
    searchQuery,
    filterStatus,
    filterRestaurant,
    filterDateFrom,
    filterDateTo,
    sortBy,
    sortDirection,
    currentPage,
    pageSize,
    filteredOrders,
    sortedOrders,
    paginatedOrders,
    totalPages,
    resetFilters,
    initialize,
    createOrder,
    saveDraft,
    updateOrder,
    submitDraft,
    deleteOrder,
    updateOrderStatus,
    getOrderById,
    mealStatistics,
    clearError,
  }
})
