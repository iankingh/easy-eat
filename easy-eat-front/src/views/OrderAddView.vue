<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import OrderForm from '@/components/orders/OrderForm.vue'
import { useToast } from '@/composables/useToast'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'
import type { OrderItem } from '@/types/order'
import { getErrorMessage } from '@/utils/error'

interface OrderFormPayload {
  restaurantId: string
  items: OrderItem[]
}

const router = useRouter()
const restaurantStore = useRestaurantStore()
const orderStore = useOrderStore()
const toast = useToast()
const saving = ref(false)

onMounted(() => {
  void initializeView()
})

async function initializeView() {
  try {
    await Promise.all([restaurantStore.initialize(), orderStore.initialize()])
  } catch (error) {
    toast.error(getErrorMessage(error, '初始化資料失敗，請稍後再試'))
  }
}

async function saveDraft(payload: OrderFormPayload) {
  await createOrder(payload, true)
}

async function submitOrder(payload: OrderFormPayload) {
  await createOrder(payload, false)
}

async function createOrder(payload: OrderFormPayload, asDraft: boolean) {
  saving.value = true
  try {
    const order = asDraft
      ? await orderStore.saveDraft(payload.restaurantId, payload.items)
      : await orderStore.createOrder(payload.restaurantId, payload.items)
    toast.success(asDraft ? '草稿已儲存' : '訂單已送出')
    await router.push({ name: 'order-detail', params: { id: order.id } })
  } catch (error) {
    toast.error(getErrorMessage(error, asDraft ? '儲存草稿失敗' : '建立訂單失敗'))
  } finally {
    saving.value = false
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
