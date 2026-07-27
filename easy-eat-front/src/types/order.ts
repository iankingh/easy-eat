export type OrderStatus = 'draft' | 'pending' | 'completed' | 'cancelled'
export type EditableOrderStatus = Extract<OrderStatus, 'draft' | 'pending'>

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
  status: OrderStatus
  createdAt: string
}

export interface CreateOrderItemInput {
  menuItemId: string
  quantity: number
  note: string
}

export interface CreateOrderInput {
  restaurantId: string
  items: CreateOrderItemInput[]
}

export type UpdateOrderInput = CreateOrderInput

export interface UpdateOrderStatusInput {
  status: OrderStatus
}

export interface MealStatistic {
  name: string
  price: number
  quantity: number
  total: number
}
