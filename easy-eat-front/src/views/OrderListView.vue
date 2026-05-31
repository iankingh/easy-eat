<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { useOrderStore } from '../stores/order'
import { useRouter } from 'vue-router'

const orderStore = useOrderStore()
const router = useRouter()

function viewDetail(id: string) {
  router.push(`/orders/${id}`)
}

function deleteOrder(id: string) {
  if (confirm('確定要刪除此訂單？')) {
    orderStore.deleteOrder(id)
  }
}
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>所有訂餐清單</h1>
      <RouterLink to="/orders/add" class="btn btn-primary">＋ 新增訂單</RouterLink>
    </div>

    <div v-if="orderStore.orders.length === 0" class="empty-state">
      <p>目前沒有訂單</p>
      <RouterLink to="/orders/add" class="btn btn-primary">立即新增</RouterLink>
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
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="order in orderStore.orders" :key="order.id">
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
            <td class="actions">
              <button class="btn btn-sm btn-info" @click="viewDetail(order.id)">詳細</button>
              <button class="btn btn-sm btn-danger" @click="deleteOrder(order.id)">刪除</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
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
}
.actions .btn + .btn {
  margin-left: 4px;
}
</style>
