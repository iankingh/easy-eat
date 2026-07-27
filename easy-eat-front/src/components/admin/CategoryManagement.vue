<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useRestaurantStore, type MenuCategory } from '@/stores/restaurant'
import { getErrorMessage } from '@/utils/error'

type CategorySortKey = 'name' | 'enabled'
type SortDirection = 'asc' | 'desc'

const restaurantStore = useRestaurantStore()
const toast = useToast()

const searchQuery = ref('')
const sortBy = ref<CategorySortKey>('name')
const sortDirection = ref<SortDirection>('asc')
const newName = ref('')
const newNameError = ref('')
const editId = ref<string | null>(null)
const editName = ref('')
const editNameError = ref('')
const deletionErrors = ref<Record<string, string>>({})
const operationKey = ref('')

const filteredCategories = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const direction = sortDirection.value === 'asc' ? 1 : -1

  return restaurantStore.categories
    .filter((category) => !query || category.name.toLowerCase().includes(query))
    .sort((left, right) => {
      if (sortBy.value === 'enabled') {
        return (Number(left.enabled) - Number(right.enabled)) * direction
      }
      return left.name.localeCompare(right.name, 'zh-TW') * direction
    })
})

function validateName(value: string): string {
  return value.trim() ? '' : '請輸入分類名稱'
}

function usageCount(categoryId: string): number {
  return restaurantStore.restaurants.reduce(
    (count, restaurant) =>
      count + restaurant.menuItems.filter((item) => item.categoryId === categoryId).length,
    0,
  )
}

async function addCategory() {
  newNameError.value = validateName(newName.value)
  if (newNameError.value) return

  operationKey.value = 'create'
  try {
    await restaurantStore.addCategory(newName.value)
    newName.value = ''
    toast.success('分類已新增')
  } catch (error) {
    newNameError.value = getErrorMessage(error, '新增分類失敗')
    toast.error(newNameError.value)
  } finally {
    operationKey.value = ''
  }
}

function startEdit(category: MenuCategory) {
  editId.value = category.id
  editName.value = category.name
  editNameError.value = ''
}

function cancelEdit() {
  editId.value = null
  editName.value = ''
  editNameError.value = ''
}

async function saveCategory() {
  if (!editId.value) return

  editNameError.value = validateName(editName.value)
  if (editNameError.value) return

  operationKey.value = `edit:${editId.value}`
  try {
    await restaurantStore.updateCategory(editId.value, editName.value)
    cancelEdit()
    toast.success('分類資料已更新')
  } catch (error) {
    editNameError.value = getErrorMessage(error, '更新分類失敗')
    toast.error(editNameError.value)
  } finally {
    operationKey.value = ''
  }
}

async function toggleEnabled(category: MenuCategory) {
  operationKey.value = `toggle:${category.id}`
  try {
    await restaurantStore.setCategoryEnabled(category.id, !category.enabled)
    toast.success(category.enabled ? '分類已停用' : '分類已啟用')
  } catch (error) {
    toast.error(getErrorMessage(error, '更新分類狀態失敗'))
  } finally {
    operationKey.value = ''
  }
}

async function deleteCategory(category: MenuCategory) {
  if (!confirm(`確定要刪除分類「${category.name}」？`)) return

  delete deletionErrors.value[category.id]
  operationKey.value = `delete:${category.id}`
  try {
    await restaurantStore.deleteCategory(category.id)
    if (editId.value === category.id) {
      cancelEdit()
    }
    toast.success('分類已刪除')
  } catch (error) {
    const message = getErrorMessage(error, '刪除分類失敗')
    deletionErrors.value[category.id] = message
    toast.error(message)
  } finally {
    operationKey.value = ''
  }
}
</script>

<template>
  <div class="category-layout">
    <section class="card" aria-labelledby="new-category-title">
      <h2 id="new-category-title">新增餐點分類</h2>
      <form class="create-form" @submit.prevent="addCategory">
        <div class="field">
          <label class="field-label" for="new-category-name">分類名稱</label>
          <input
            id="new-category-name"
            v-model="newName"
            class="form-input"
            :class="{ invalid: newNameError }"
            type="text"
            autocomplete="off"
            placeholder="例如：主餐、飲料"
            :disabled="restaurantStore.loading"
            @input="newNameError = ''"
          />
          <p v-if="newNameError" class="field-error">{{ newNameError }}</p>
        </div>
        <button class="btn btn-primary" type="submit" :disabled="restaurantStore.loading">
          {{ operationKey === 'create' ? '新增中…' : '新增分類' }}
        </button>
      </form>
    </section>

    <section class="card" aria-labelledby="category-list-title">
      <div class="card-heading">
        <h2 id="category-list-title">分類管理</h2>
        <p>顯示 {{ filteredCategories.length }} / {{ restaurantStore.categories.length }} 個分類</p>
      </div>

      <p class="category-note">停用分類後，該分類下的餐點將不會出現在點餐選單。</p>

      <div class="toolbar">
        <input
          v-model="searchQuery"
          class="form-input"
          type="search"
          placeholder="搜尋分類名稱…"
          aria-label="搜尋分類名稱"
          :disabled="restaurantStore.loading"
        />
        <select
          v-model="sortBy"
          class="form-select"
          aria-label="分類排序欄位"
          :disabled="restaurantStore.loading"
        >
          <option value="name">依名稱排序</option>
          <option value="enabled">依啟用狀態排序</option>
        </select>
        <button
          class="btn btn-secondary btn-sm"
          type="button"
          :disabled="restaurantStore.loading"
          @click="sortDirection = sortDirection === 'asc' ? 'desc' : 'asc'"
        >
          {{ sortDirection === 'asc' ? '升冪 ↑' : '降冪 ↓' }}
        </button>
      </div>

      <div v-if="restaurantStore.categories.length === 0" class="empty-state">
        尚未建立任何餐點分類
      </div>
      <div v-else-if="filteredCategories.length === 0" class="empty-state compact">
        找不到符合條件的分類
      </div>

      <div v-else class="category-list">
        <article
          v-for="category in filteredCategories"
          :key="category.id"
          class="category-row"
          :class="{ disabled: !category.enabled }"
        >
          <template v-if="editId === category.id">
            <div class="edit-field">
              <input
                v-model="editName"
                class="form-input"
                :class="{ invalid: editNameError }"
                aria-label="分類名稱"
                :disabled="restaurantStore.loading"
                @input="editNameError = ''"
                @keyup.enter="saveCategory"
              />
              <p v-if="editNameError" class="field-error">{{ editNameError }}</p>
            </div>
            <div class="actions">
              <button
                class="btn btn-sm btn-primary"
                type="button"
                :disabled="restaurantStore.loading"
                @click="saveCategory"
              >
                {{ operationKey === `edit:${category.id}` ? '儲存中…' : '儲存' }}
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
            <div class="category-summary">
              <div class="category-name-line">
                <strong>{{ category.name }}</strong>
                <span class="status-badge" :class="{ off: !category.enabled }">
                  {{ category.enabled ? '已啟用' : '已停用' }}
                </span>
              </div>
              <span>{{ usageCount(category.id) }} 項餐點使用中</span>
              <p v-if="deletionErrors[category.id]" class="delete-error" role="alert">
                {{ deletionErrors[category.id] }}
              </p>
            </div>
            <div class="actions">
              <button
                class="btn btn-sm"
                :class="category.enabled ? 'btn-secondary' : 'btn-info'"
                type="button"
                :disabled="restaurantStore.loading"
                @click="toggleEnabled(category)"
              >
                {{
                  operationKey === `toggle:${category.id}`
                    ? '更新中…'
                    : category.enabled
                      ? '停用'
                      : '啟用'
                }}
              </button>
              <button
                class="btn btn-sm btn-secondary"
                type="button"
                :disabled="restaurantStore.loading"
                @click="startEdit(category)"
              >
                編輯
              </button>
              <button
                class="btn btn-sm btn-danger"
                type="button"
                :disabled="restaurantStore.loading"
                @click="deleteCategory(category)"
              >
                {{ operationKey === `delete:${category.id}` ? '刪除中…' : '刪除' }}
              </button>
            </div>
          </template>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.category-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.8fr) minmax(360px, 1.4fr);
  align-items: start;
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

.field-error,
.delete-error {
  margin-top: 4px;
  color: #c53030;
  font-size: 0.8rem;
}

.invalid {
  border-color: #e53e3e;
}

.card-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 8px;
  border-bottom: 2px solid #eee;
}

.card-heading h2 {
  margin: 0;
  padding: 0;
  border: 0;
}

.card-heading p,
.category-note {
  color: #718096;
  font-size: 0.82rem;
}

.category-note {
  margin: 12px 0;
}

.toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}

.toolbar .form-input {
  flex: 1;
  min-width: 120px;
}

.empty-state.compact {
  padding: 28px 20px;
}

.category-list {
  display: grid;
  gap: 10px;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 7px;
}

.category-row.disabled {
  background: #edf2f7;
}

.category-summary {
  flex: 1;
  min-width: 140px;
}

.category-summary > span {
  color: #718096;
  font-size: 0.8rem;
}

.category-name-line {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
}

.status-badge {
  padding: 2px 7px;
  color: #276749;
  font-size: 0.7rem;
  font-weight: 600;
  background: #c6f6d5;
  border-radius: 999px;
}

.status-badge.off {
  color: #4a5568;
  background: #e2e8f0;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 5px;
  flex-wrap: wrap;
}

@media (max-width: 880px) {
  .category-layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 560px) {
  .create-form,
  .category-row,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar .form-input,
  .toolbar .form-select,
  .toolbar .btn {
    width: 100%;
  }

  .create-form .btn {
    width: 100%;
    margin-top: 0;
  }

  .actions .btn {
    flex: 1;
  }
}
</style>
