import { orderApi } from '@/api/orderApi'
import type {
  CreateOrderInput,
  CreateOrderItemInput,
  EditableOrderStatus,
  MealStatistic,
  Order,
  OrderItem,
  OrderStatus,
  UpdateOrderInput,
} from '@/types/order'

export const orderService = {
  getOrders(): Promise<Order[]> {
    return orderApi.list()
  },

  getOrderById(id: string): Promise<Order | null> {
    return orderApi.detail(id)
  },

  createOrder(payload: CreateOrderInput, status: EditableOrderStatus = 'pending'): Promise<Order> {
    return orderApi.create(payload, status)
  },

  updateOrder(id: string, payload: UpdateOrderInput): Promise<Order> {
    return orderApi.update(id, payload)
  },

  submitOrder(id: string): Promise<Order> {
    return orderApi.submit(id)
  },

  deleteOrder(id: string): Promise<void> {
    return orderApi.remove(id)
  },

  updateOrderStatus(id: string, status: OrderStatus): Promise<Order> {
    return orderApi.updateStatus(id, { status })
  },

  getMealStatistics(): Promise<MealStatistic[]> {
    return orderApi.statistics()
  },

  mapOrderItemsToCreateInput(items: OrderItem[]): CreateOrderItemInput[] {
    return items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      note: item.note,
    }))
  },
}
