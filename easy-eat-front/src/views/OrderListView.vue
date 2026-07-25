<script setup lang="ts">
import { RouterLink, useRouter } from 'vue-router'
import { useOrderStore } from '../stores/order'
import type { OrderStatus } from '../stores/order'
import { useToast } from '@/composables/useToast'
import { onMounted } from 'vue'

const orderStore = useOrderStore()
const router = useRouter()
const toast = useToast()

onMounted(() => {
  void initializeView()
})

async function initializeView() {
  if (!orderStore.initialized) {
    try {
      await orderStore.initialize()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '載入訂單失敗，請稍後再試')
    }
  }
}

function viewDetail(id: string) {
  router.push(`/orders/${id}`)
}

async function deleteOrder(id: string) {
  if (!confirm('確定要刪除此訂單？')) return
  try {
    await orderStore.deleteOrder(id)
    toast.success('訂單已刪除')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '刪除訂單失敗，請稍後再試')
  }
}

async function changeStatus(id: string, status: OrderStatus) {
  try {
    await orderStore.updateOrderStatus(id, status)
    toast.success('訂單狀態已更新')
  } catch (error) {
    toast.error(error instanceof Error ? error.message : '更新狀態失敗')
  }
}

const STATUS_OPTIONS: { value: OrderStatus | ''; label: string }[] = [
  { value: '', label: '全部狀態' },
  { value: 'pending', label: '處理中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: '處理中',
  completed: '已完成',
  cancelled: '已取消',
}
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>所有訂餐清單</h1>
      <RouterLink to="/orders/add" class="btn btn-primary">＋ 新增訂單</RouterLink>
    </div>

    <!-- Filters -->
    <div class="filter-bar">
      <select v-model="orderStore.filterStatus" class="form-select filter-select">
        <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <input
        v-model="orderStore.filterRestaurant"
        type="text"
        class="filter-input"
        placeholder="搜尋餐廳名稱…"
      />
      <input
        v-model="orderStore.filterDateFrom"
        type="date"
        class="filter-input"
        title="起始日期"
      />
      <span class="filter-sep">～</span>
      <input
        v-model="orderStore.filterDateTo"
        type="date"
        class="filter-input"
        title="結束日期"
      />
      <button class="btn btn-secondary btn-sm" @click="orderStore.resetFilters">重置篩選</button>
    </div>

    <p class="result-count">
      顯示 {{ orderStore.filteredOrders.length }} / {{ orderStore.orders.length }} 筆訂單
    </p>

    <div v-if="orderStore.filteredOrders.length === 0" class="empty-state">
      <p>{{ orderStore.orders.length === 0 ? '目前沒有訂單' : '無符合條件的訂單' }}</p>
      <RouterLink v-if="orderStore.orders.length === 0" to="/orders/add" class="btn btn-primary">
        立即新增
      </RouterLink>
    </div>

    <div v-else class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>訂單編號</th>
            <th>餐廳名稱</th>
            <th>訂單品項 × 數量</th>
            <th>備註</th>
            <th>總金額</th>
            <th>狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orderStore.filteredOrders" :key="order.id">
            <td class="order-id">{{ order.orderId }}</td>
            <td>{{ order.restaurantName }}</td>
            <td>
              <div v-for="item in order.items" :key="item.menuItemId" class="item-line">
                {{ item.name }} × {{ item.quantity }}
              </div>
            </td>
            <td>
              <div v-for="item in order.items" :key="item.menuItemId + '-note'" class="item-line">
                {{ item.note || '—' }}
              </div>
            </td>
            <td class="amount">{{ order.totalAmount }} 元</td>
            <td>
              <span class="status-badge" :class="`status-${order.status}`">
                {{ STATUS_LABEL[order.status] ?? order.status }}
              </span>
            </td>
            <td class="actions">
              <button class="btn btn-sm btn-info" @click="viewDetail(order.id)">詳細</button>
              <button
                v-if="order.status === 'pending'"
                class="btn btn-sm btn-success"
                @click="changeStatus(order.id, 'completed')"
              >
                完成
              </button>
              <button
                v-if="order.status === 'pending'"
                class="btn btn-sm btn-warning"
                @click="changeStatus(order.id, 'cancelled')"
              >
                取消
              </button>
              <button class="btn btn-sm btn-danger" @click="deleteOrder(order.id)">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.filter-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.filter-select,
.filter-input {
  padding: 6px 10px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.88rem;
}
.filter-sep {
  color: #888;
  font-size: 0.85rem;
}
.result-count {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 8px;
}
.item-line {
  white-space: nowrap;
}
.order-id {
  font-size: 0.8rem;
  color: #666;
}
.amount {
  font-weight: bold;
  color: #e74c3c;
}
.actions {
  white-space: nowrap;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
}
.status-pending {
  background: #fef3cd;
  color: #856404;
}
.status-completed {
  background: #d4edda;
  color: #155724;
}
.status-cancelled {
  background: #f8d7da;
  color: #721c24;
}
.btn-success {
  background: #27ae60;
  color: #fff;
  border: none;
}
.btn-success:hover {
  background: #219a52;
}
.btn-warning {
  background: #e67e22;
  color: #fff;
  border: none;
}
.btn-warning:hover {
  background: #ca6f1e;
}
</style>
