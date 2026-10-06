<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import OrderForm from '@/components/orders/OrderForm.vue'
import { useAsyncAction } from '@/composables/useAsyncAction'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'
import type { OrderItem } from '@/types/order'

interface OrderFormPayload {
  restaurantId: string
  items: OrderItem[]
}

const router = useRouter()
const restaurantStore = useRestaurantStore()
const orderStore = useOrderStore()
const { loading: saving, run: runAction } = useAsyncAction()

onMounted(() => {
  void initializeView()
})

async function initializeView() {
  await runAction(() => Promise.all([restaurantStore.initialize(), orderStore.initialize()]), {
    errorMessage: '初始化資料失敗，請稍後再試',
  })
}

async function saveDraft(payload: OrderFormPayload) {
  await createOrder(payload, true)
}

async function submitOrder(payload: OrderFormPayload) {
  await createOrder(payload, false)
}

async function createOrder(payload: OrderFormPayload, asDraft: boolean) {
  const order = await runAction(
    () =>
      asDraft
        ? orderStore.saveDraft(payload.restaurantId, payload.items)
        : orderStore.createOrder(payload.restaurantId, payload.items),
    {
      successMessage: asDraft ? '草稿已儲存' : '訂單已送出',
      errorMessage: asDraft ? '儲存草稿失敗' : '建立訂單失敗',
    },
  )
  if (order) {
    await router.push({ name: 'order-detail', params: { id: order.id } })
  }
}

function cancel() {
  void router.push({ name: 'order-list' })
}
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>新增訂單</h1>
    </div>

    <OrderForm :loading="saving" @save-draft="saveDraft" @submit="submitOrder" @cancel="cancel" />
  </section>
</template>
