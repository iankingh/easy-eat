import {
  createOrder,
  deleteOrder,
  getOrderById,
  listMealStatistics,
  listOrders,
  submitOrder,
  updateOrder,
  updateOrderStatus,
} from '@/mock/server'
import type {
  CreateOrderInput,
  EditableOrderStatus,
  MealStatistic,
  Order,
  UpdateOrderInput,
  UpdateOrderStatusInput,
} from '@/types/order'

export const orderApi = {
  list(): Promise<Order[]> {
    return listOrders()
  },

  detail(id: string): Promise<Order | null> {
    return getOrderById(id)
  },

  create(payload: CreateOrderInput, status: EditableOrderStatus = 'pending'): Promise<Order> {
    return createOrder(payload, status)
  },

  update(id: string, payload: UpdateOrderInput): Promise<Order> {
    return updateOrder(id, payload)
  },

  submit(id: string): Promise<Order> {
    return submitOrder(id)
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
