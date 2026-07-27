import type { OrderStatus } from '@/types/order'

export const DEFAULT_PAGE_SIZE = 20

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: '草稿',
  pending: '處理中',
  completed: '已完成',
  cancelled: '已取消',
}

export const ORDER_STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: '全部狀態' },
  { value: 'draft', label: ORDER_STATUS_LABELS.draft },
  { value: 'pending', label: ORDER_STATUS_LABELS.pending },
  { value: 'completed', label: ORDER_STATUS_LABELS.completed },
  { value: 'cancelled', label: ORDER_STATUS_LABELS.cancelled },
]

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  draft: ['pending'],
  pending: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}
