<script setup lang="ts">
import { computed } from 'vue'
import { useOrderStore } from '../stores/order'

const orderStore = useOrderStore()

const stats = computed(() => orderStore.mealStatistics)
const totalQty = computed(() => stats.value.reduce((s, i) => s + i.quantity, 0))
const totalAmount = computed(() => stats.value.reduce((s, i) => s + i.total, 0))
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>訂單餐點統計表</h1>
    </div>

    <div v-if="stats.length === 0" class="empty-state">
      <p>尚無統計資料，請先新增訂單</p>
      <RouterLink to="/orders/add" class="btn btn-primary">新增訂單</RouterLink>
    </div>

    <div v-else>
      <p class="summary-note">統計來自 {{ orderStore.orders.length }} 筆訂單</p>
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
            <tr v-for="(stat, index) in stats" :key="stat.name">
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
  color: #666;
  font-size: 0.9rem;
  margin-bottom: 12px;
}
.rank {
  text-align: center;
}
.badge {
  display: inline-block;
  width: 24px;
  height: 24px;
  line-height: 24px;
  border-radius: 50%;
  text-align: center;
  font-weight: bold;
  font-size: 0.85rem;
  color: #fff;
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
  font-weight: bold;
  color: #e74c3c;
}
.total-label {
  text-align: right;
  font-weight: bold;
  background: #f5f5f5;
}
</style>
