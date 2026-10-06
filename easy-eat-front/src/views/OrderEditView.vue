<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import OrderForm from '@/components/orders/OrderForm.vue'
import OrderStatusBadge from '@/components/orders/OrderStatusBadge.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'
import type { EditableOrderStatus, OrderItem } from '@/types/order'

interface OrderFormPayload {
  restaurantId: string
  items: OrderItem[]
}

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()
const restaurantStore = useRestaurantStore()
const { loading: saving, run: runAction } = useAsyncAction()

const orderId = computed(() => (typeof route.params.id === 'string' ? route.params.id : ''))
const order = computed(() => orderStore.getOrderById(orderId.value))
const isEditable = computed(
  () => order.value?.status === 'draft' || order.value?.status === 'pending',
)
const editableStatus = computed<EditableOrderStatus | undefined>(() => {
  const status = order.value?.status
  return status === 'draft' || status === 'pending' ? status : undefined
})

onMounted(() => {
  void initializeView()
})

async function initializeView() {
  await runAction(() => Promise.all([restaurantStore.initialize(), orderStore.initialize()]), {
    errorMessage: '載入訂單失敗，請稍後再試',
  })
}

async function saveOrder(payload: OrderFormPayload) {
  const currentOrder = order.value
  if (!currentOrder || !isEditable.value) return
  const result = await runAction(
    () => orderStore.updateOrder(currentOrder.id, payload.restaurantId, payload.items),
    {
      successMessage: currentOrder.status === 'draft' ? '草稿已儲存' : '訂單已更新',
      errorMessage: '更新訂單失敗',
    },
  )
  if (result) {
    await router.push({ name: 'order-detail', params: { id: currentOrder.id } })
  }
}

async function saveAndSubmit(payload: OrderFormPayload) {
  const currentOrder = order.value
  if (!currentOrder || currentOrder.status !== 'draft') return
  const result = await runAction(
    async () => {
      await orderStore.updateOrder(currentOrder.id, payload.restaurantId, payload.items)
      return orderStore.submitDraft(currentOrder.id)
    },
    {
      successMessage: '訂單已儲存並送出',
      errorMessage: '儲存並送出訂單失敗',
    },
  )
  if (result) {
    await router.push({ name: 'order-detail', params: { id: currentOrder.id } })
  }
}

function cancel() {
  const currentOrder = order.value
  if (currentOrder) {
    void router.push({ name: 'order-detail', params: { id: currentOrder.id } })
    return
  }
  void router.push({ name: 'order-list' })
}
</script>

<template>
  <section
    class="page-section"
    :aria-busy="saving || orderStore.loading || restaurantStore.loading"
  >
    <div class="section-header">
      <h1>編輯訂單</h1>
      <button class="btn btn-secondary" @click="cancel">← 返回</button>
    </div>

    <div
      v-if="
        (orderStore.loading && !orderStore.initialized) ||
        (restaurantStore.loading && !restaurantStore.initialized)
      "
      class="empty-state"
    >
      <LoadingSpinner label="訂單載入中" />
    </div>

    <p v-else-if="orderStore.errorMessage || restaurantStore.errorMessage" role="alert">
      {{ orderStore.errorMessage || restaurantStore.errorMessage }}
    </p>

    <div v-else-if="!order" class="empty-state">
      <p>找不到此訂單</p>
      <RouterLink :to="{ name: 'order-list' }" class="btn btn-primary">返回清單</RouterLink>
    </div>

    <div v-else-if="!isEditable" class="read-only-card">
      <OrderStatusBadge :status="order.status" />
      <h2>此訂單無法編輯</h2>
      <p>已完成或已取消的訂單僅供檢視。</p>
      <RouterLink :to="{ name: 'order-detail', params: { id: order.id } }" class="btn btn-primary">
        查看訂單內容
      </RouterLink>
    </div>

    <OrderForm
      v-else
      :key="order.id"
      mode="edit"
      :order-status="editableStatus"
      :initial-restaurant-id="order.restaurantId"
      :initial-items="order.items"
      :loading="saving"
      @save="saveOrder"
      @submit="saveAndSubmit"
      @cancel="cancel"
    />
  </section>
</template>

<style scoped>
.read-only-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 44px 24px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  text-align: center;
}

.read-only-card h2 {
  color: #2c3e50;
  font-size: 1.2rem;
}

.read-only-card p {
  color: #777;
}
</style>
