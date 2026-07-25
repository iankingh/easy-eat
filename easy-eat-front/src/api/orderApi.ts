import {
  createOrder,
  deleteOrder,
  getOrderById,
  listMealStatistics,
  listOrders,
  updateOrderStatus,
} from '@/mock/server'
import type { CreateOrderInput, MealStatistic, Order, UpdateOrderStatusInput } from '@/types/order'

export const orderApi = {
  list(): Promise<Order[]> {
    return listOrders()
  },

  detail(id: string): Promise<Order | null> {
    return getOrderById(id)
  },

  create(payload: CreateOrderInput): Promise<Order> {
    return createOrder(payload)
  },

  remove(id: string): Promise<void> {
    return deleteOrder(id)
  },

  updateStatus(id: string, payload: UpdateOrderStatusInput): Promise<Order> {
    return updateOrderStatus(id, payload)
  },

  statistics(): Promise<MealStatistic[]> {
    return listMealStatistics()
  },
}
