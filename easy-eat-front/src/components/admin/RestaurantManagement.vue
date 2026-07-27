<script setup lang="ts">
import { ref } from 'vue'
import MenuItemManagement from '@/components/admin/MenuItemManagement.vue'
import { useToast } from '@/composables/useToast'
import { useRestaurantStore, type Restaurant, type RestaurantSortKey } from '@/stores/restaurant'
import { getErrorMessage } from '@/utils/error'

const restaurantStore = useRestaurantStore()
const toast = useToast()

const newName = ref('')
const newNameError = ref('')
const editId = ref<string | null>(null)
const editName = ref('')
const editNameError = ref('')
const activeRestaurantId = ref<string | null>(null)
const operationKey = ref('')

function validateName(value: string): string {
  return value.trim() ? '' : '請輸入餐廳名稱'
}

async function addRestaurant() {
  newNameError.value = validateName(newName.value)
  if (newNameError.value) return

  operationKey.value = 'create'
  try {
    await restaurantStore.addRestaurant(newName.value)
    newName.value = ''
    toast.success('餐廳已新增')
  } catch (error) {
    newNameError.value = getErrorMessage(error, '新增餐廳失敗')
    toast.error(newNameError.value)
  } finally {
    operationKey.value = ''
  }
}

function startEdit(restaurant: Restaurant) {
  editId.value = restaurant.id
  editName.value = restaurant.name
  editNameError.value = ''
}

function cancelEdit() {
  editId.value = null
  editName.value = ''
  editNameError.value = ''
}

async function saveRestaurant() {
  if (!editId.value) return

  editNameError.value = validateName(editName.value)
  if (editNameError.value) return

  operationKey.value = `edit:${editId.value}`
  try {
    await restaurantStore.updateRestaurant(editId.value, editName.value)
    cancelEdit()
    toast.success('餐廳資料已更新')
  } catch (error) {
    editNameError.value = getErrorMessage(error, '更新餐廳失敗')
    toast.error(editNameError.value)
  } finally {
    operationKey.value = ''
  }
}

async function toggleEnabled(restaurant: Restaurant) {
  operationKey.value = `toggle:${restaurant.id}`
  try {
    await restaurantStore.setRestaurantEnabled(restaurant.id, !restaurant.enabled)
    toast.success(restaurant.enabled ? '餐廳已停用' : '餐廳已啟用')
  } catch (error) {
    toast.error(getErrorMessage(error, '更新餐廳狀態失敗'))
  } finally {
    operationKey.value = ''
  }
}

async function deleteRestaurant(restaurant: Restaurant) {
  if (!confirm(`確定要刪除「${restaurant.name}」及其所有餐點？`)) return

  operationKey.value = `delete:${restaurant.id}`
  try {
    await restaurantStore.deleteRestaurant(restaurant.id)
    if (activeRestaurantId.value === restaurant.id) {
      activeRestaurantId.value = null
    }
    if (editId.value === restaurant.id) {
      cancelEdit()
    }
    toast.success('餐廳已刪除')
  } catch (error) {
    toast.error(getErrorMessage(error, '刪除餐廳失敗'))
  } finally {
    operationKey.value = ''
  }
}

function toggleMenu(restaurantId: string) {
  activeRestaurantId.value = activeRestaurantId.value === restaurantId ? null : restaurantId
}

function setSortBy(event: Event) {
  restaurantStore.sortBy = (event.target as HTMLSelectElement).value as RestaurantSortKey
}
</script>

<template>
  <div class="management-stack">
    <section class="card" aria-labelledby="new-restaurant-title">
      <h2 id="new-restaurant-title">新增餐廳</h2>
      <form class="create-form" @submit.prevent="addRestaurant">
        <div class="field">
          <label class="field-label" for="new-restaurant-name">餐廳名稱</label>
          <input
            id="new-restaurant-name"
            v-model="newName"
            class="form-input"
            :class="{ invalid: newNameError }"
            type="text"
            autocomplete="off"
            placeholder="例如：好吃便當"
            :disabled="restaurantStore.loading"
            :aria-describedby="newNameError ? 'new-restaurant-error' : undefined"
            @input="newNameError = ''"
          />
          <p v-if="newNameError" id="new-restaurant-error" class="field-error">
            {{ newNameError }}
          </p>
        </div>
        <button class="btn btn-primary" type="submit" :disabled="restaurantStore.loading">
          {{ operationKey === 'create' ? '新增中…' : '新增餐廳' }}
        </button>
      </form>
    </section>

    <section class="card" aria-labelledby="restaurant-list-title">
      <div class="card-heading">
        <div>
          <h2 id="restaurant-list-title">餐廳管理</h2>
          <p class="result-count">
            顯示 {{ restaurantStore.filteredRestaurants.length }} /
            {{ restaurantStore.restaurants.length }} 間
          </p>
        </div>
      </div>

      <div class="toolbar">
        <label class="search-field">
          <span class="sr-only">搜尋餐廳或餐點</span>
          <input
            v-model="restaurantStore.searchQuery"
            class="form-input"
            type="search"
            placeholder="搜尋餐廳或餐點…"
            :disabled="restaurantStore.loading"
          />
        </label>
        <select
          class="form-select"
          :value="restaurantStore.sortBy"
          :disabled="restaurantStore.loading"
          aria-label="餐廳排序欄位"
          @change="setSortBy"
        >
          <option value="name">依名稱排序</option>
          <option value="enabled">依啟用狀態排序</option>
        </select>
        <button
          class="btn btn-secondary btn-sm"
          type="button"
          :disabled="restaurantStore.loading"
          @click="
            restaurantStore.sortDirection = restaurantStore.sortDirection === 'asc' ? 'desc' : 'asc'
          "
        >
          {{ restaurantStore.sortDirection === 'asc' ? '升冪 ↑' : '降冪 ↓' }}
        </button>
      </div>

      <div v-if="restaurantStore.restaurants.length === 0" class="empty-state">
        尚未建立任何餐廳
      </div>
      <div v-else-if="restaurantStore.filteredRestaurants.length === 0" class="empty-state compact">
        找不到符合條件的餐廳
      </div>

      <div v-else class="restaurant-list">
        <article
          v-for="restaurant in restaurantStore.filteredRestaurants"
          :key="restaurant.id"
          class="restaurant-block"
          :class="{ disabled: !restaurant.enabled }"
        >
          <div class="restaurant-row">
            <template v-if="editId === restaurant.id">
              <div class="edit-field">
                <input
                  v-model="editName"
                  class="form-input"
                  :class="{ invalid: editNameError }"
                  aria-label="餐廳名稱"
                  :disabled="restaurantStore.loading"
                  @input="editNameError = ''"
                  @keyup.enter="saveRestaurant"
                />
                <p v-if="editNameError" class="field-error">{{ editNameError }}</p>
              </div>
              <div class="row-actions">
                <button
                  class="btn btn-sm btn-primary"
                  type="button"
                  :disabled="restaurantStore.loading"
                  @click="saveRestaurant"
                >
                  {{ operationKey === `edit:${restaurant.id}` ? '儲存中…' : '儲存' }}
                </button>
                <button
                  class="btn btn-sm btn-secondary"
                  type="button"
                  :disabled="restaurantStore.loading"
                  @click="cancelEdit"
                >
                  取消
                </button>
              </div>
            </template>

            <template v-else>
              <div class="restaurant-summary">
                <div class="restaurant-title-line">
                  <strong>{{ restaurant.name }}</strong>
                  <span class="status-badge" :class="{ off: !restaurant.enabled }">
                    {{ restaurant.enabled ? '已啟用' : '已停用' }}
                  </span>
                </div>
                <span class="menu-count">{{ restaurant.menuItems.length }} 項餐點</span>
              </div>
              <div class="row-actions">
                <button
                  class="btn btn-sm"
                  :class="restaurant.enabled ? 'btn-secondary' : 'btn-info'"
                  type="button"
                  :disabled="restaurantStore.loading"
                  :aria-pressed="restaurant.enabled"
                  @click="toggleEnabled(restaurant)"
                >
                  {{
                    operationKey === `toggle:${restaurant.id}`
                      ? '更新中…'
                      : restaurant.enabled
                        ? '停用'
                        : '啟用'
                  }}
                </button>
                <button
                  class="btn btn-sm btn-secondary"
                  type="button"
                  :disabled="restaurantStore.loading"
                  @click="startEdit(restaurant)"
                >
                  編輯
                </button>
                <button
                  class="btn btn-sm btn-info"
                  type="button"
                  :disabled="restaurantStore.loading"
                  :aria-expanded="activeRestaurantId === restaurant.id"
                  @click="toggleMenu(restaurant.id)"
                >
                  {{ activeRestaurantId === restaurant.id ? '收起餐點' : '管理餐點' }}
                </button>
                <button
                  class="btn btn-sm btn-danger"
                  type="button"
                  :disabled="restaurantStore.loading"
                  @click="deleteRestaurant(restaurant)"
                >
                  {{ operationKey === `delete:${restaurant.id}` ? '刪除中…' : '刪除' }}
                </button>
              </div>
            </template>
          </div>

          <MenuItemManagement
            v-if="activeRestaurantId === restaurant.id"
            :key="restaurant.id"
            :restaurant="restaurant"
          />
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.management-stack {
  display: grid;
  gap: 20px;
}

.card {
  margin-bottom: 0;
}

.create-form {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.field,
.edit-field {
  flex: 1;
  min-width: 0;
}

.field-label {
  display: block;
  margin-bottom: 5px;
  color: #4a5568;
  font-size: 0.86rem;
  font-weight: 600;
}

.field .form-input,
.edit-field .form-input {
  width: 100%;
}

.create-form .btn {
  margin-top: 27px;
}

.field-error {
  margin-top: 4px;
  color: #c53030;
  font-size: 0.8rem;
}

.invalid {
  border-color: #e53e3e;
}

.card-heading h2 {
  margin-bottom: 0;
}

.result-count {
  margin-top: 5px;
  color: #718096;
  font-size: 0.84rem;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.search-field {
  flex: 1;
}

.search-field .form-input {
  width: 100%;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.empty-state.compact {
  padding: 28px 20px;
}

.restaurant-list {
  display: grid;
  gap: 12px;
}

.restaurant-block {
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.restaurant-block.disabled {
  border-color: #cbd5e0;
}

.restaurant-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  background: #f8fafc;
}

.restaurant-block.disabled .restaurant-row {
  background: #edf2f7;
}

.restaurant-summary {
  flex: 1;
  min-width: 140px;
}

.restaurant-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.menu-count {
  color: #718096;
  font-size: 0.82rem;
}

.status-badge {
  display: inline-block;
  padding: 2px 7px;
  color: #276749;
  font-size: 0.72rem;
  font-weight: 600;
  background: #c6f6d5;
  border-radius: 999px;
}

.status-badge.off {
  color: #4a5568;
  background: #e2e8f0;
}

.row-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}

@media (max-width: 720px) {
  .toolbar,
  .restaurant-row {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar .form-select,
  .toolbar .btn,
  .row-actions .btn {
    flex: 1;
  }

  .row-actions {
    justify-content: stretch;
  }
}

@media (max-width: 520px) {
  .create-form {
    flex-direction: column;
  }

  .create-form .field,
  .create-form .btn {
    width: 100%;
  }

  .create-form .btn {
    margin-top: 0;
  }
}
</style>
