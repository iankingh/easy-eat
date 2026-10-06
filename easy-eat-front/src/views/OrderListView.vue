<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge.vue'
import { ORDER_STATUS_OPTIONS } from '@/constants/order'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useOrderStore, type OrderSortKey } from '@/stores/order'
import type { OrderStatus } from '@/types/order'

type FinalStatus = Extract<OrderStatus, 'completed' | 'cancelled'>

const orderStore = useOrderStore()
const router = useRouter()
const { loading: actionLoading, run: runAction } = useAsyncAction()

const SORT_OPTIONS: { value: OrderSortKey; label: string }[] = [
  { value: 'createdAt', label: '建立時間' },
  { value: 'restaurantName', label: '餐廳名稱' },
  { value: 'totalAmount', label: '總金額' },
  { value: 'status', label: '訂單狀態' },
]

const resultStart = computed(() =>
  orderStore.filteredOrders.length === 0
    ? 0
    : (orderStore.currentPage - 1) * orderStore.pageSize + 1,
)
const resultEnd = computed(() =>
  Math.min(orderStore.currentPage * orderStore.pageSize, orderStore.filteredOrders.length),
)

onMounted(() => {
  orderStore.pageSize = 20
  void initializeView()
})

async function initializeView() {
  await runAction(() => orderStore.initialize(), { errorMessage: '載入訂單失敗，請稍後再試' })
}

function viewDetail(id: string) {
  void router.push({ name: 'order-detail', params: { id } })
}

function editOrder(id: string) {
  void router.push({ name: 'order-edit', params: { id } })
}

async function submitDraft(id: string) {
  await runAction(() => orderStore.submitDraft(id), {
    successMessage: '訂單已送出',
    errorMessage: '送出訂單失敗',
  })
}

async function deleteOrder(id: string) {
  if (!confirm('確定要刪除此訂單？')) return
  await runAction(() => orderStore.deleteOrder(id), {
    successMessage: '訂單已刪除',
    errorMessage: '刪除訂單失敗，請稍後再試',
  })
}

async function changeStatus(id: string, status: FinalStatus) {
  await runAction(() => orderStore.updateOrderStatus(id, status), {
    successMessage: status === 'completed' ? '訂單已標記完成' : '訂單已取消',
    errorMessage: '更新狀態失敗',
  })
}

function toggleSortDirection() {
  orderStore.sortDirection = orderStore.sortDirection === 'asc' ? 'desc' : 'asc'
}

function goToPage(page: number) {
  orderStore.currentPage = Math.min(Math.max(page, 1), orderStore.totalPages)
}
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>所有訂餐清單</h1>
      <RouterLink :to="{ name: 'order-add' }" class="btn btn-primary">＋ 新增訂單</RouterLink>
    </div>

    <div class="filter-panel">
      <div class="filter-row">
        <label class="filter-field search-field">
          <span>搜尋</span>
          <input
            v-model="orderStore.searchQuery"
            type="search"
            class="form-input"
            placeholder="訂單編號、餐廳、餐點或備註"
          />
        </label>
        <label class="filter-field">
          <span>狀態</span>
          <select v-model="orderStore.filterStatus" class="form-select">
            <option
              v-for="option in ORDER_STATUS_OPTIONS"
              :key="option.value"
              :value="option.value"
            >
              {{ option.label }}
            </option>
          </select>
        </label>
        <label class="filter-field">
          <span>餐廳</span>
          <input
            v-model="orderStore.filterRestaurant"
            type="search"
            class="form-input"
            placeholder="餐廳名稱"
          />
        </label>
      </div>

      <div class="filter-row">
        <label class="filter-field">
          <span>起始日期</span>
          <input v-model="orderStore.filterDateFrom" type="date" class="form-input" />
        </label>
        <label class="filter-field">
          <span>結束日期</span>
          <input v-model="orderStore.filterDateTo" type="date" class="form-input" />
        </label>
        <label class="filter-field">
          <span>排序</span>
          <select v-model="orderStore.sortBy" class="form-select">
            <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <button class="btn btn-secondary btn-sm direction-button" @click="toggleSortDirection">
          {{ orderStore.sortDirection === 'asc' ? '升冪 ↑' : '降冪 ↓' }}
        </button>
        <button class="btn btn-secondary btn-sm reset-button" @click="orderStore.resetFilters">
          重置篩選
        </button>
      </div>
    </div>

    <p class="result-count">
      共 {{ orderStore.filteredOrders.length }} 筆符合條件
      <template v-if="orderStore.filteredOrders.length > 0">
        ，目前顯示第 {{ resultStart }}–{{ resultEnd }} 筆
      </template>
    </p>

    <div v-if="orderStore.loading && !orderStore.initialized" class="empty-state">
      <LoadingSpinner />
    </div>

    <p v-else-if="orderStore.errorMessage && !orderStore.initialized" role="alert">
      {{ orderStore.errorMessage }}
    </p>

    <div v-else-if="orderStore.filteredOrders.length === 0" class="empty-state">
      <p>{{ orderStore.orders.length === 0 ? '目前沒有訂單' : '無符合條件的訂單' }}</p>
      <RouterLink
        v-if="orderStore.orders.length === 0"
        :to="{ name: 'order-add' }"
        class="btn btn-primary"
      >
        立即新增
      </RouterLink>
    </div>

    <template v-else>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>訂單編號</th>
              <th>建立時間</th>
              <th>餐廳名稱</th>
              <th>訂單品項 × 數量</th>
              <th>總金額</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="order in orderStore.paginatedOrders" :key="order.id">
              <td class="order-id">{{ order.orderId }}</td>
              <td class="created-at">{{ new Date(order.createdAt).toLocaleString('zh-TW') }}</td>
              <td>{{ order.restaurantName }}</td>
              <td>
                <div v-for="item in order.items" :key="item.menuItemId" class="item-line">
                  {{ item.name }} × {{ item.quantity }}
                  <span v-if="item.note" class="item-note">（{{ item.note }}）</span>
                </div>
              </td>
              <td class="amount">{{ order.totalAmount }} 元</td>
              <td><OrderStatusBadge :status="order.status" /></td>
              <td>
                <div class="actions">
                  <button class="btn btn-sm btn-info" @click="viewDetail(order.id)">詳細</button>
                  <button
                    v-if="order.status === 'draft' || order.status === 'pending'"
                    class="btn btn-sm btn-secondary"
                    :disabled="actionLoading"
                    @click="editOrder(order.id)"
                  >
                    編輯
                  </button>
                  <button
                    v-if="order.status === 'draft'"
                    class="btn btn-sm btn-primary"
                    :disabled="actionLoading"
                    @click="submitDraft(order.id)"
                  >
                    送出
                  </button>
                  <template v-if="order.status === 'pending'">
                    <button
                      class="btn btn-sm btn-success"
                      :disabled="actionLoading"
                      @click="changeStatus(order.id, 'completed')"
                    >
                      完成
                    </button>
                    <button
                      class="btn btn-sm btn-warning"
                      :disabled="actionLoading"
                      @click="changeStatus(order.id, 'cancelled')"
                    >
                      取消
                    </button>
                  </template>
                  <button
                    class="btn btn-sm btn-danger"
                    :disabled="actionLoading"
                    @click="deleteOrder(order.id)"
                  >
                    刪除
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav class="pagination" aria-label="訂單分頁">
        <button
          class="btn btn-secondary btn-sm"
          :disabled="orderStore.currentPage <= 1"
          @click="goToPage(orderStore.currentPage - 1)"
        >
          上一頁
        </button>
        <span>第 {{ orderStore.currentPage }} / {{ orderStore.totalPages }} 頁</span>
        <button
          class="btn btn-secondary btn-sm"
          :disabled="orderStore.currentPage >= orderStore.totalPages"
          @click="goToPage(orderStore.currentPage + 1)"
        >
          下一頁
        </button>
      </nav>
    </template>
  </section>
</template>

<style scoped>
.filter-panel {
  margin-bottom: 12px;
  padding: 16px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
}

.filter-row {
  display: flex;
  align-items: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.filter-row + .filter-row {
  margin-top: 10px;
}

.filter-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.filter-field > span {
  color: #666;
  font-size: 0.8rem;
}

.search-field {
  flex: 1;
  min-width: 260px;
}

.search-field .form-input {
  width: 100%;
}

.direction-button,
.reset-button {
  margin-bottom: 1px;
}

.reset-button {
  margin-left: auto;
}

.result-count {
  margin-bottom: 8px;
  color: #666;
  font-size: 0.85rem;
}

.item-line {
  white-space: nowrap;
}

.item-note {
  color: #888;
  font-size: 0.82rem;
}

.order-id,
.created-at {
  color: #666;
  font-size: 0.8rem;
  white-space: nowrap;
}

.amount {
  color: #e74c3c;
  font-weight: bold;
  white-space: nowrap;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 205px;
}

.btn-success {
  background: #27ae60;
  color: #fff;
}

.btn-warning {
  background: #e67e22;
  color: #fff;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin-top: 18px;
  color: #666;
  font-size: 0.88rem;
}

@media (max-width: 720px) {
  .filter-field,
  .search-field {
    width: 100%;
    min-width: 0;
  }

  .filter-field .form-input,
  .filter-field .form-select {
    width: 100%;
  }

  .reset-button {
    margin-left: 0;
  }
}
</style>
