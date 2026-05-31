<script setup lang="ts">
import { ref } from 'vue'
import { useRestaurantStore } from '../stores/restaurant'
import type { MenuItem } from '../stores/restaurant'

const restaurantStore = useRestaurantStore()
const CATEGORIES = ['食物', '飲料', '點心', '套餐', '其他']

// ─── Restaurant section ───────────────────────────────────────────
const newRestaurantName = ref('')
const editRestaurantId = ref<string | null>(null)
const editRestaurantName = ref('')

function addRestaurant() {
  const name = newRestaurantName.value.trim()
  if (!name) return
  restaurantStore.addRestaurant(name)
  newRestaurantName.value = ''
}

function startEditRestaurant(id: string, name: string) {
  editRestaurantId.value = id
  editRestaurantName.value = name
}

function saveRestaurant() {
  const name = editRestaurantName.value.trim()
  if (!name || !editRestaurantId.value) return
  restaurantStore.updateRestaurant(editRestaurantId.value, name)
  editRestaurantId.value = null
}

function cancelEditRestaurant() {
  editRestaurantId.value = null
}

function deleteRestaurant(id: string) {
  if (!confirm('確定要刪除此餐廳及其所有餐點？')) return
  restaurantStore.deleteRestaurant(id)
  if (activeRestaurantId.value === id) activeRestaurantId.value = null
}

// ─── MenuItem section ─────────────────────────────────────────────
const activeRestaurantId = ref<string | null>(null)

const newItem = ref<Omit<MenuItem, 'id'>>({ name: '', price: 0, category: '食物' })
const editItemId = ref<string | null>(null)
const editItem = ref<Omit<MenuItem, 'id'>>({ name: '', price: 0, category: '食物' })

function toggleRestaurant(id: string) {
  if (activeRestaurantId.value === id) {
    activeRestaurantId.value = null
  } else {
    activeRestaurantId.value = id
    newItem.value = { name: '', price: 0, category: '食物' }
    editItemId.value = null
  }
}

function addMenuItem() {
  if (!activeRestaurantId.value) return
  const name = newItem.value.name.trim()
  if (!name || newItem.value.price <= 0) {
    alert('請填寫餐點名稱及有效價格')
    return
  }
  restaurantStore.addMenuItem(activeRestaurantId.value, { ...newItem.value, name })
  newItem.value = { name: '', price: 0, category: '食物' }
}

function startEditItem(id: string, item: MenuItem) {
  editItemId.value = id
  editItem.value = { name: item.name, price: item.price, category: item.category }
}

function saveMenuItem() {
  if (!activeRestaurantId.value || !editItemId.value) return
  const name = editItem.value.name.trim()
  if (!name || editItem.value.price <= 0) {
    alert('請填寫餐點名稱及有效價格')
    return
  }
  restaurantStore.updateMenuItem(activeRestaurantId.value, editItemId.value, {
    ...editItem.value,
    name,
  })
  editItemId.value = null
}

function cancelEditItem() {
  editItemId.value = null
}

function deleteMenuItem(itemId: string) {
  if (!activeRestaurantId.value) return
  if (confirm('確定要刪除此餐點？')) {
    restaurantStore.deleteMenuItem(activeRestaurantId.value, itemId)
    if (editItemId.value === itemId) editItemId.value = null
  }
}
</script>

<template>
  <section class="page-section">
    <div class="section-header">
      <h1>後台設定</h1>
    </div>

    <!-- ── Add Restaurant ───────────────────────────────── -->
    <div class="card">
      <h2>新增餐廳</h2>
      <div class="inline-form">
        <input
          v-model="newRestaurantName"
          class="form-input"
          type="text"
          placeholder="餐廳名稱"
          @keyup.enter="addRestaurant"
        />
        <button class="btn btn-primary" @click="addRestaurant">新增</button>
      </div>
    </div>

    <!-- ── Restaurant List ─────────────────────────────── -->
    <div class="card">
      <h2>餐廳管理</h2>

      <div v-if="restaurantStore.restaurants.length === 0" class="empty-state">
        尚未建立任何餐廳
      </div>

      <div v-for="r in restaurantStore.restaurants" :key="r.id" class="restaurant-block">
        <!-- Restaurant Row -->
        <div class="restaurant-row">
          <template v-if="editRestaurantId === r.id">
            <input v-model="editRestaurantName" class="form-input" @keyup.enter="saveRestaurant" />
            <button class="btn btn-sm btn-primary" @click="saveRestaurant">儲存</button>
            <button class="btn btn-sm btn-secondary" @click="cancelEditRestaurant">取消</button>
          </template>
          <template v-else>
            <span class="restaurant-name">{{ r.name }}</span>
            <span class="menu-count">{{ r.menuItems.length }} 項餐點</span>
            <button
              class="btn btn-sm btn-secondary"
              @click="startEditRestaurant(r.id, r.name)"
            >
              編輯
            </button>
            <button class="btn btn-sm btn-info" @click="toggleRestaurant(r.id)">
              {{ activeRestaurantId === r.id ? '收起餐點' : '管理餐點' }}
            </button>
            <button class="btn btn-sm btn-danger" @click="deleteRestaurant(r.id)">刪除</button>
          </template>
        </div>

        <!-- Menu Items Panel -->
        <div v-if="activeRestaurantId === r.id" class="menu-panel">
          <h3>餐點列表</h3>

          <!-- Add Menu Item Form -->
          <div class="inline-form menu-add-form">
            <input
              v-model="newItem.name"
              class="form-input"
              type="text"
              placeholder="餐點名稱"
            />
            <input
              v-model.number="newItem.price"
              class="form-input price-input"
              type="number"
              min="1"
              placeholder="單價"
            />
            <select v-model="newItem.category" class="form-select category-select">
              <option v-for="cat in CATEGORIES" :key="cat" :value="cat">{{ cat }}</option>
            </select>
            <button class="btn btn-primary btn-sm" @click="addMenuItem">＋ 新增</button>
          </div>

          <!-- Menu Items Table -->
          <div v-if="r.menuItems.length === 0" class="hint">尚無餐點，請新增</div>
          <div v-else class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>餐點名稱</th>
                  <th>類別</th>
                  <th>單價</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="item in r.menuItems" :key="item.id">
                  <template v-if="editItemId === item.id">
                    <td>
                      <input v-model="editItem.name" class="form-input" />
                    </td>
                    <td>
                      <select v-model="editItem.category" class="form-select">
                        <option v-for="cat in CATEGORIES" :key="cat" :value="cat">
                          {{ cat }}
                        </option>
                      </select>
                    </td>
                    <td>
                      <input
                        v-model.number="editItem.price"
                        class="form-input price-input"
                        type="number"
                        min="1"
                      />
                    </td>
                    <td class="actions">
                      <button class="btn btn-sm btn-primary" @click="saveMenuItem">儲存</button>
                      <button class="btn btn-sm btn-secondary" @click="cancelEditItem">
                        取消
                      </button>
                    </td>
                  </template>
                  <template v-else>
                    <td>{{ item.name }}</td>
                    <td>
                      <span class="category-badge">{{ item.category }}</span>
                    </td>
                    <td class="price">{{ item.price }} 元</td>
                    <td class="actions">
                      <button
                        class="btn btn-sm btn-secondary"
                        @click="startEditItem(item.id, item)"
                      >
                        編輯
                      </button>
                      <button
                        class="btn btn-sm btn-danger"
                        @click="deleteMenuItem(item.id)"
                      >
                        刪除
                      </button>
                    </td>
                  </template>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.restaurant-block {
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  margin-bottom: 16px;
  overflow: hidden;
}
.restaurant-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  background: #fafafa;
  flex-wrap: wrap;
}
.restaurant-name {
  font-weight: bold;
  font-size: 1rem;
  flex: 1;
  min-width: 120px;
}
.menu-count {
  font-size: 0.85rem;
  color: #888;
}
.menu-panel {
  padding: 16px;
  background: #fff;
  border-top: 1px solid #e0e0e0;
}
.menu-panel h3 {
  font-size: 0.95rem;
  margin-bottom: 12px;
  color: #555;
}
.menu-add-form {
  margin-bottom: 16px;
  flex-wrap: wrap;
}
.price-input {
  width: 90px;
}
.category-select {
  width: 90px;
}
.category-badge {
  display: inline-block;
  padding: 2px 8px;
  background: #e8f0fe;
  color: #4a90d9;
  border-radius: 12px;
  font-size: 0.8rem;
}
.price {
  color: #e74c3c;
  font-weight: bold;
}
.actions {
  white-space: nowrap;
}
.actions .btn + .btn {
  margin-left: 4px;
}
</style>
