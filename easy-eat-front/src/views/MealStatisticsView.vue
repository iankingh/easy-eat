<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useToast } from '@/composables/useToast'
import { useOrderStore } from '@/stores/order'
import { getErrorMessage } from '@/utils/error'

const orderStore = useOrderStore()
const toast = useToast()

const stats = computed(() => orderStore.mealStatistics)
const totalQty = computed(() => stats.value.reduce((sum, item) => sum + item.quantity, 0))
const totalAmount = computed(() => stats.value.reduce((sum, item) => sum + item.total, 0))
const includedOrderCount = computed(
  () =>
    orderStore.orders.filter((order) => order.status === 'pending' || order.status === 'completed')
      .length,
)

onMounted(() => {
  void initializeView()
})

async function initializeView() {
  try {
    await orderStore.initialize()
  } catch (error) {
    toast.error(getErrorMessage(error, '載入統計失敗，請稍後再試'))
  }
}
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>訂單餐點統計表</h1>
    </div>

    <div v-if="orderStore.loading && !orderStore.initialized" class="empty-state">
      <p>統計資料載入中...</p>
    </div>

    <div v-else-if="stats.length === 0" class="empty-state">
      <p>目前沒有已送出訂單的統計資料</p>
      <RouterLink :to="{ name: 'order-add' }" class="btn btn-primary">新增訂單</RouterLink>
    </div>

    <div v-else>
      <p class="summary-note">
        統計來自 {{ includedOrderCount }} 筆處理中或已完成訂單，不包含草稿及已取消訂單。
      </p>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>排名</th>
              <th>餐點名稱</th>
              <th>單價</th>
              <th>總數量</th>
              <th>總金額</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(stat, index) in stats" :key="`${stat.name}-${stat.price}`">
              <td class="rank">
                <span v-if="index === 0" class="badge gold">1</span>
                <span v-else-if="index === 1" class="badge silver">2</span>
                <span v-else-if="index === 2" class="badge bronze">3</span>
                <span v-else>{{ index + 1 }}</span>
              </td>
              <td>{{ stat.name }}</td>
              <td>{{ stat.price }} 元</td>
              <td class="qty">{{ stat.quantity }}</td>
              <td class="amount">{{ stat.total }} 元</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" class="total-label">合計</td>
              <td class="qty">{{ totalQty }}</td>
              <td class="amount">{{ totalAmount }} 元</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-note {
  margin-bottom: 12px;
  color: #666;
  font-size: 0.9rem;
}

.rank {
  text-align: center;
}

.badge {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 0.85rem;
  font-weight: bold;
  line-height: 24px;
  text-align: center;
}

.gold {
  background: #f1c40f;
  color: #333;
}

.silver {
  background: #95a5a6;
}

.bronze {
  background: #cd7f32;
}

.qty {
  font-weight: bold;
  text-align: center;
}

.amount {
  color: #e74c3c;
  font-weight: bold;
}

.total-label {
  text-align: right;
}
</style>
