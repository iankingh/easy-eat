<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useOrderStore } from '@/stores/order'
import type { OrderStatus } from '@/types/order'

type FinalStatus = Extract<OrderStatus, 'completed' | 'cancelled'>

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const { loading: actionLoading, run: runAction } = useAsyncAction()

const orderId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const order = computed(() => orderStore.getOrderById(orderId.value))
const canEdit = computed(() => order.value?.status === 'draft' || order.value?.status === 'pending')
const isReadOnly = computed(
  () => order.value?.status === 'completed' || order.value?.status === 'cancelled',
)

onMounted(() => {
  void initializeView()
})

async function initializeView() {
  await runAction(() => orderStore.initialize(), { errorMessage: '載入訂單失敗，請稍後再試' })
}

async function submitDraft() {
  const currentOrder = order.value
  if (!currentOrder || currentOrder.status !== 'draft') return

  await runAction(() => orderStore.submitDraft(currentOrder.id), {
    successMessage: '訂單已送出',
    errorMessage: '送出訂單失敗',
  })
}

async function changeStatus(status: FinalStatus) {
  const currentOrder = order.value
  if (!currentOrder || currentOrder.status !== 'pending') return

  await runAction(() => orderStore.updateOrderStatus(currentOrder.id, status), {
    successMessage: status === 'completed' ? '訂單已標記完成' : '訂單已取消',
    errorMessage: '更新狀態失敗',
  })
}

function goBack() {
  void router.push({ name: 'order-list' })
}
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>訂單詳細內容</h1>
      <button class="btn btn-secondary" @click="goBack">← 返回清單</button>
    </div>

    <div v-if="orderStore.loading && !orderStore.initialized" class="empty-state">
      <LoadingSpinner />
    </div>

    <p v-else-if="orderStore.errorMessage && !orderStore.initialized" role="alert">
      {{ orderStore.errorMessage }}
    </p>

    <div v-else-if="!order" class="empty-state">
      <p>找不到此訂單</p>
      <RouterLink :to="{ name: 'order-list' }" class="btn btn-primary">返回清單</RouterLink>
    </div>

    <div v-else class="detail-card">
      <div class="detail-meta">
        <div class="meta-item">
          <span class="meta-label">餐廳名稱</span>
          <span class="meta-value">{{ order.restaurantName }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">訂單編號</span>
          <span class="meta-value mono">{{ order.orderId }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">建立時間</span>
          <span class="meta-value">{{ new Date(order.createdAt).toLocaleString('zh-TW') }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">訂單狀態</span>
          <OrderStatusBadge :status="order.status" />
        </div>
      </div>

      <div v-if="canEdit" class="status-actions">
        <RouterLink
          :to="{ name: 'order-edit', params: { id: order.id } }"
          class="btn btn-sm btn-info"
        >
          編輯訂單
        </RouterLink>
        <button
          v-if="order.status === 'draft'"
          class="btn btn-sm btn-primary"
          :disabled="actionLoading"
          @click="submitDraft"
        >
          送出訂單
        </button>
        <template v-if="order.status === 'pending'">
          <button
            class="btn btn-sm btn-success"
            :disabled="actionLoading"
            @click="changeStatus('completed')"
          >
            ✓ 標記完成
          </button>
          <button
            class="btn btn-sm btn-warning"
            :disabled="actionLoading"
            @click="changeStatus('cancelled')"
          >
            ✕ 取消訂單
          </button>
        </template>
      </div>
      <p v-else-if="isReadOnly" class="read-only-note">此訂單已結案，內容僅供檢視。</p>

      <h2 class="sub-heading">訂單明細</h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>品項</th>
              <th>單價</th>
              <th>數量</th>
              <th>小計</th>
              <th>備註</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in order.items" :key="item.menuItemId">
              <td>{{ item.name }}</td>
              <td>{{ item.price }} 元</td>
              <td>{{ item.quantity }}</td>
              <td class="amount">{{ item.price * item.quantity }} 元</td>
              <td>{{ item.note || '—' }}</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="total-label">總金額</td>
              <td colspan="2" class="total-amount">{{ order.totalAmount }} 元</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.detail-card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 24px;
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 1fr));
  gap: 12px 24px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.meta-item {
  display: flex;
  gap: 12px;
}

.meta-label {
  min-width: 80px;
  font-weight: bold;
  color: #555;
}

.meta-value {
  color: #333;
}

.meta-value.mono {
  font-family: monospace;
  font-size: 0.9rem;
}

.status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.read-only-note {
  margin-bottom: 20px;
  padding: 10px 12px;
  border-radius: 5px;
  background: #f5f5f5;
  color: #777;
}

.sub-heading {
  margin-bottom: 12px;
  font-size: 1.1rem;
  color: #333;
}

.amount {
  font-weight: bold;
  color: #e74c3c;
}

.total-label {
  text-align: right;
}

.total-amount {
  font-size: 1.1rem;
  color: #b03a2e;
  background: #fff8e1;
}

.btn-success {
  background: #27ae60;
  color: #fff;
}

.btn-warning {
  background: #e67e22;
  color: #fff;
}

@media (max-width: 720px) {
  .detail-meta {
    grid-template-columns: 1fr;
  }
}
</style>
