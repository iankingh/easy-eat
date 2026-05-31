<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useRestaurantStore } from '../stores/restaurant'
import { useOrderStore } from '../stores/order'
import type { OrderItem } from '../stores/order'

const router = useRouter()
const restaurantStore = useRestaurantStore()
const orderStore = useOrderStore()

interface DraftItem {
  menuItemId: string
  quantity: number
  note: string
}

const selectedRestaurantId = ref('')
const orderItems = ref<DraftItem[]>([{ menuItemId: '', quantity: 1, note: '' }])

const selectedRestaurant = computed(() =>
  restaurantStore.restaurants.find((r) => r.id === selectedRestaurantId.value),
)

const totalAmount = computed(() => {
  if (!selectedRestaurant.value) return 0
  return orderItems.value.reduce((sum, item) => {
    const menuItem = selectedRestaurant.value!.menuItems.find((m) => m.id === item.menuItemId)
    return sum + (menuItem ? menuItem.price * (item.quantity || 0) : 0)
  }, 0)
})

function getMenuItemPrice(menuItemId: string): number {
  if (!selectedRestaurant.value) return 0
  const item = selectedRestaurant.value.menuItems.find((m) => m.id === menuItemId)
  return item ? item.price : 0
}

function getSubtotal(item: DraftItem): number {
  return getMenuItemPrice(item.menuItemId) * (item.quantity || 0)
}

function onRestaurantChange() {
  orderItems.value = [{ menuItemId: '', quantity: 1, note: '' }]
}

function addItem() {
  orderItems.value.push({ menuItemId: '', quantity: 1, note: '' })
}

function removeItem(index: number) {
  orderItems.value.splice(index, 1)
}

function submitOrder() {
  if (!selectedRestaurantId.value) {
    alert('請選擇餐廳')
    return
  }
  const validItems = orderItems.value.filter((i) => i.menuItemId && i.quantity > 0)
  if (validItems.length === 0) {
    alert('請至少選擇一項餐點')
    return
  }
  const items: OrderItem[] = validItems.map((i) => {
    const menuItem = selectedRestaurant.value!.menuItems.find((m) => m.id === i.menuItemId)!
    return {
      menuItemId: i.menuItemId,
      name: menuItem.name,
      price: menuItem.price,
      quantity: i.quantity,
      note: i.note,
    }
  })
  const order = orderStore.createOrder(
    selectedRestaurantId.value,
    selectedRestaurant.value!.name,
    items,
  )
  router.push(`/orders/${order.id}`)
}
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>新增訂單</h1>
    </div>

    <form class="order-form" @submit.prevent="submitOrder">
      <!-- 餐廳選擇 -->
      <div class="form-group">
        <label class="form-label">餐廳</label>
        <select
          v-model="selectedRestaurantId"
          class="form-select"
          @change="onRestaurantChange"
          required
        >
          <option value="" disabled>請選擇餐廳</option>
          <option v-for="r in restaurantStore.restaurants" :key="r.id" :value="r.id">
            {{ r.name }}
          </option>
        </select>
        <p v-if="restaurantStore.restaurants.length === 0" class="hint">
          尚未建立餐廳，請先前往
          <RouterLink to="/admin">後台設定</RouterLink>
          新增餐廳。
        </p>
      </div>

      <!-- 餐點項目表 -->
      <div class="form-group">
        <div class="items-header">
          <h2>餐點項目</h2>
          <button
            v-if="selectedRestaurantId"
            type="button"
            class="btn btn-secondary btn-sm"
            @click="addItem"
          >
            ＋ 新增餐點
          </button>
        </div>

        <p v-if="!selectedRestaurantId" class="hint">請先選擇餐廳</p>

        <div v-else class="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>餐點名稱</th>
                <th>類別</th>
                <th>單價</th>
                <th>數量</th>
                <th>小計</th>
                <th>備註</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(item, index) in orderItems" :key="index">
                <td>
                  <select v-model="item.menuItemId" class="form-select" required>
                    <option value="" disabled>請選擇</option>
                    <option
                      v-for="m in selectedRestaurant!.menuItems"
                      :key="m.id"
                      :value="m.id"
                    >
                      {{ m.name }}
                    </option>
                  </select>
                </td>
                <td>
                  {{
                    item.menuItemId
                      ? selectedRestaurant!.menuItems.find((m) => m.id === item.menuItemId)
                          ?.category
                      : '—'
                  }}
                </td>
                <td>{{ getMenuItemPrice(item.menuItemId) || '—' }} 元</td>
                <td>
                  <input
                    type="number"
                    v-model.number="item.quantity"
                    class="qty-input"
                    min="1"
                    max="99"
                    required
                  />
                </td>
                <td class="amount">{{ item.menuItemId ? getSubtotal(item) + ' 元' : '—' }}</td>
                <td>
                  <input
                    type="text"
                    v-model="item.note"
                    class="note-input"
                    placeholder="備註（可空白）"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    class="btn btn-sm btn-danger"
                    :disabled="orderItems.length === 1"
                    @click="removeItem(index)"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- 總金額 -->
      <div v-if="selectedRestaurantId" class="total-price-box">
        <span>總金額</span>
        <span class="total-amount">{{ totalAmount }} 元</span>
      </div>

      <!-- 送出 / 取消 -->
      <div class="form-actions">
        <button type="submit" class="btn btn-primary" :disabled="!selectedRestaurantId">
          送出訂單
        </button>
        <RouterLink to="/" class="btn btn-secondary">取消</RouterLink>
      </div>
    </form>
  </section>
</template>

<style scoped>
.items-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.items-header h2 {
  margin: 0;
  font-size: 1.1rem;
}
.qty-input {
  width: 64px;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  text-align: center;
}
.note-input {
  width: 140px;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
}
.amount {
  font-weight: bold;
  color: #e74c3c;
}
.total-price-box {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  margin: 20px 0;
  padding: 12px 20px;
  background: #fff8e1;
  border: 1px solid #ffe082;
  border-radius: 6px;
  font-size: 1rem;
}
.total-amount {
  font-size: 1.4rem;
  font-weight: bold;
  color: #e74c3c;
}
</style>
