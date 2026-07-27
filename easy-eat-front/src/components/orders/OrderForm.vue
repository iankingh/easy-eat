<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRestaurantStore } from '@/stores/restaurant'
import type { EditableOrderStatus, OrderItem } from '@/types/order'

interface DraftItem {
  menuItemId: string
  quantity: number
  note: string
}

interface OrderFormPayload {
  restaurantId: string
  items: OrderItem[]
}

const props = withDefaults(
  defineProps<{
    mode?: 'create' | 'edit'
    orderStatus?: EditableOrderStatus
    initialRestaurantId?: string
    initialItems?: OrderItem[]
    loading?: boolean
  }>(),
  {
    mode: 'create',
    orderStatus: 'pending',
    initialRestaurantId: '',
    initialItems: () => [],
    loading: false,
  },
)

const emit = defineEmits<{
  saveDraft: [payload: OrderFormPayload]
  submit: [payload: OrderFormPayload]
  save: [payload: OrderFormPayload]
  cancel: []
}>()

const restaurantStore = useRestaurantStore()
const selectedRestaurantId = ref(props.initialRestaurantId)
const orderItems = ref<DraftItem[]>(toDraftItems(props.initialItems))
const restaurantError = ref('')
const itemErrors = reactive<Record<number, { menuItemId?: string; quantity?: string }>>({})
const formError = ref('')

const selectedRestaurant = computed(() =>
  restaurantStore.activeRestaurants.find(
    (restaurant) => restaurant.id === selectedRestaurantId.value,
  ),
)

const totalAmount = computed(() =>
  orderItems.value.reduce(
    (sum, item) => sum + getMenuItemPrice(item.menuItemId) * validQuantity(item.quantity),
    0,
  ),
)

watch(
  () => [props.initialRestaurantId, props.initialItems] as const,
  ([restaurantId, items]) => {
    selectedRestaurantId.value = restaurantId
    orderItems.value = toDraftItems(items)
    clearErrors()
  },
)

function toDraftItems(items: OrderItem[]): DraftItem[] {
  if (items.length === 0) {
    return [{ menuItemId: '', quantity: 1, note: '' }]
  }
  return items.map((item) => ({
    menuItemId: item.menuItemId,
    quantity: item.quantity,
    note: item.note,
  }))
}

function validQuantity(quantity: number): number {
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 0
}

function getMenuItemPrice(menuItemId: string): number {
  return selectedRestaurant.value?.menuItems.find((item) => item.id === menuItemId)?.price ?? 0
}

function getMenuItemCategory(menuItemId: string): string {
  const menuItem = selectedRestaurant.value?.menuItems.find((item) => item.id === menuItemId)
  if (!menuItem) return '—'
  return (
    restaurantStore.activeCategories.find((category) => category.id === menuItem.categoryId)
      ?.name ?? '—'
  )
}

function getSubtotal(item: DraftItem): number {
  return getMenuItemPrice(item.menuItemId) * validQuantity(item.quantity)
}

function isMenuItemSelected(menuItemId: string, currentIndex: number): boolean {
  return orderItems.value.some(
    (item, index) => index !== currentIndex && item.menuItemId === menuItemId,
  )
}

function onRestaurantChange() {
  orderItems.value = [{ menuItemId: '', quantity: 1, note: '' }]
  clearErrors()
}

function addItem() {
  orderItems.value.push({ menuItemId: '', quantity: 1, note: '' })
  formError.value = ''
}

function removeItem(index: number) {
  orderItems.value.splice(index, 1)
  clearErrors()
}

function clearErrors() {
  restaurantError.value = ''
  formError.value = ''
  for (const key of Object.keys(itemErrors)) {
    delete itemErrors[Number(key)]
  }
}

function validate(): OrderFormPayload | null {
  clearErrors()
  const restaurant = selectedRestaurant.value
  if (!selectedRestaurantId.value) {
    restaurantError.value = '請選擇餐廳'
  } else if (!restaurant) {
    restaurantError.value = '所選餐廳目前未啟用，請重新選擇'
  }

  if (orderItems.value.length === 0) {
    formError.value = '請至少新增一項餐點'
  }

  const seenMenuItemIds = new Set<string>()
  const items: OrderItem[] = []

  orderItems.value.forEach((item, index) => {
    const errors: { menuItemId?: string; quantity?: string } = {}
    const menuItem = restaurant?.menuItems.find((candidate) => candidate.id === item.menuItemId)

    if (!item.menuItemId) {
      errors.menuItemId = '請選擇餐點'
    } else if (!menuItem) {
      errors.menuItemId = '此餐點目前未啟用，請重新選擇'
    } else if (seenMenuItemIds.has(item.menuItemId)) {
      errors.menuItemId = '同一餐點不可重複加入'
    } else {
      seenMenuItemIds.add(item.menuItemId)
    }

    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
      errors.quantity = '數量須為 1 至 99 的整數'
    }

    if (Object.keys(errors).length > 0) {
      itemErrors[index] = errors
      return
    }

    if (menuItem) {
      items.push({
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.quantity,
        note: item.note.trim(),
      })
    }
  })

  if (restaurantError.value || formError.value || Object.keys(itemErrors).length > 0) {
    formError.value ||= '請修正欄位內容後再繼續'
    return null
  }

  return { restaurantId: selectedRestaurantId.value, items }
}

function emitAction(action: 'saveDraft' | 'submit' | 'save') {
  const payload = validate()
  if (!payload) return

  if (action === 'saveDraft') {
    emit('saveDraft', payload)
  } else if (action === 'submit') {
    emit('submit', payload)
  } else {
    emit('save', payload)
  }
}

function submitForm() {
  emitAction(props.mode === 'edit' && props.orderStatus === 'pending' ? 'save' : 'submit')
}
</script>

<template>
  <form class="order-form" novalidate @submit.prevent="submitForm">
    <div class="form-group">
      <label class="form-label" for="restaurant-select">餐廳</label>
      <select
        id="restaurant-select"
        v-model="selectedRestaurantId"
        class="form-select restaurant-select"
        :class="{ invalid: restaurantError }"
        :disabled="loading"
        @change="onRestaurantChange"
      >
        <option value="" disabled>請選擇餐廳</option>
        <option
          v-for="restaurant in restaurantStore.activeRestaurants"
          :key="restaurant.id"
          :value="restaurant.id"
        >
          {{ restaurant.name }}
        </option>
      </select>
      <p v-if="restaurantError" class="field-error">{{ restaurantError }}</p>
      <p v-else-if="restaurantStore.activeRestaurants.length === 0" class="hint">
        目前沒有已啟用且可供點餐的餐廳，請先前往
        <RouterLink :to="{ name: 'admin' }">後台設定</RouterLink>。
      </p>
    </div>

    <div class="form-group">
      <div class="items-header">
        <h2>餐點項目</h2>
        <button
          v-if="selectedRestaurant"
          type="button"
          class="btn btn-secondary btn-sm"
          :disabled="loading || selectedRestaurant.menuItems.length === 0"
          @click="addItem"
        >
          ＋ 新增餐點
        </button>
      </div>

      <p v-if="!selectedRestaurantId" class="hint">請先選擇餐廳</p>
      <p v-else-if="selectedRestaurant && selectedRestaurant.menuItems.length === 0" class="hint">
        此餐廳目前沒有已啟用分類下的可用餐點。
      </p>

      <div v-else-if="selectedRestaurant" class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>餐點名稱</th>
              <th>類別</th>
              <th>單價</th>
              <th>數量</th>
              <th>小計</th>
              <th>備註</th>
              <th aria-label="操作"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, index) in orderItems" :key="index">
              <td>
                <select
                  v-model="item.menuItemId"
                  class="form-select item-select"
                  :class="{ invalid: itemErrors[index]?.menuItemId }"
                  :disabled="loading"
                >
                  <option value="" disabled>請選擇</option>
                  <option
                    v-for="menuItem in selectedRestaurant.menuItems"
                    :key="menuItem.id"
                    :value="menuItem.id"
                    :disabled="isMenuItemSelected(menuItem.id, index)"
                  >
                    {{ menuItem.name }}
                  </option>
                </select>
                <p v-if="itemErrors[index]?.menuItemId" class="field-error">
                  {{ itemErrors[index]?.menuItemId }}
                </p>
              </td>
              <td>{{ getMenuItemCategory(item.menuItemId) }}</td>
              <td>{{ item.menuItemId ? `${getMenuItemPrice(item.menuItemId)} 元` : '—' }}</td>
              <td>
                <input
                  v-model.number="item.quantity"
                  type="number"
                  class="qty-input"
                  :class="{ invalid: itemErrors[index]?.quantity }"
                  min="1"
                  max="99"
                  step="1"
                  :disabled="loading"
                />
                <p v-if="itemErrors[index]?.quantity" class="field-error quantity-error">
                  {{ itemErrors[index]?.quantity }}
                </p>
              </td>
              <td class="amount">{{ item.menuItemId ? `${getSubtotal(item)} 元` : '—' }}</td>
              <td>
                <input
                  v-model="item.note"
                  type="text"
                  class="note-input"
                  maxlength="100"
                  placeholder="備註（可空白）"
                  :disabled="loading"
                />
              </td>
              <td>
                <button
                  type="button"
                  class="btn btn-sm btn-danger"
                  :disabled="loading || orderItems.length === 1"
                  aria-label="移除餐點"
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

    <div v-if="selectedRestaurant" class="total-price-box">
      <span>總金額</span>
      <span class="total-amount">{{ totalAmount }} 元</span>
    </div>

    <p v-if="formError" class="form-error">{{ formError }}</p>

    <div class="form-actions">
      <template v-if="mode === 'create'">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading"
          @click="emitAction('saveDraft')"
        >
          儲存草稿
        </button>
        <button type="submit" class="btn btn-primary" :disabled="loading">送出訂單</button>
      </template>
      <template v-else-if="orderStatus === 'draft'">
        <button
          type="button"
          class="btn btn-secondary"
          :disabled="loading"
          @click="emitAction('save')"
        >
          儲存草稿
        </button>
        <button
          type="button"
          class="btn btn-primary"
          :disabled="loading"
          @click="emitAction('submit')"
        >
          儲存並送出
        </button>
      </template>
      <button
        v-else
        type="button"
        class="btn btn-primary"
        :disabled="loading"
        @click="emitAction('save')"
      >
        儲存變更
      </button>
      <button type="button" class="btn btn-secondary" :disabled="loading" @click="emit('cancel')">
        取消
      </button>
    </div>
  </form>
</template>

<style scoped>
.restaurant-select {
  min-width: 280px;
}

.items-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.items-header h2 {
  margin: 0;
  font-size: 1.1rem;
}

.item-select {
  min-width: 150px;
}

.qty-input,
.note-input {
  padding: 6px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 0.9rem;
}

.qty-input {
  width: 70px;
  text-align: center;
}

.note-input {
  width: 150px;
}

.invalid {
  border-color: #e74c3c;
}

.field-error,
.form-error {
  color: #c0392b;
  font-size: 0.8rem;
}

.field-error {
  margin-top: 4px;
}

.quantity-error {
  min-width: 120px;
}

.form-error {
  padding: 10px 12px;
  border-radius: 5px;
  background: #fdecea;
}

.amount {
  font-weight: bold;
  color: #e74c3c;
  white-space: nowrap;
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
}

.total-amount {
  font-size: 1.4rem;
  font-weight: bold;
  color: #e74c3c;
}

@media (max-width: 720px) {
  .restaurant-select {
    width: 100%;
    min-width: 0;
  }
}
</style>
