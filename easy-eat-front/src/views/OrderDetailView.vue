<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOrderStore } from '../stores/order'

const route = useRoute()
const router = useRouter()
const orderStore = useOrderStore()

const order = computed(() => orderStore.getOrderById(route.params.id as string))
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>訂單詳細內容</h1>
      <button class="btn btn-secondary" @click="router.back()">← 返回</button>
    </div>

    <div v-if="!order" class="empty-state">
      <p>找不到此訂單</p>
      <RouterLink to="/" class="btn btn-primary">返回清單</RouterLink>
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
      </div>

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
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}
.meta-item {
  display: flex;
  gap: 12px;
}
.meta-label {
  font-weight: bold;
  color: #555;
  min-width: 80px;
}
.meta-value {
  color: #333;
}
.meta-value.mono {
  font-family: monospace;
  font-size: 0.9rem;
}
.sub-heading {
  font-size: 1.1rem;
  margin-bottom: 12px;
  color: #333;
}
.amount {
  color: #e74c3c;
  font-weight: bold;
}
.total-label {
  text-align: right;
  font-weight: bold;
  background: #f5f5f5;
}
.total-amount {
  font-size: 1.1rem;
  font-weight: bold;
  color: #e74c3c;
  background: #fff8e1;
}
</style>
