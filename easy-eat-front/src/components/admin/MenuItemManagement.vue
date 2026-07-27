<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '@/composables/useToast'
import { useRestaurantStore, type MenuItem, type Restaurant } from '@/stores/restaurant'
import type { MenuItemInput } from '@/types/restaurant'
import { getErrorMessage } from '@/utils/error'

type MenuSortKey = 'name' | 'category' | 'price' | 'enabled'
type SortDirection = 'asc' | 'desc'

interface MenuDraft {
  name: string
  price: number | null
  categoryId: string
}

type FieldErrors = Partial<Record<keyof MenuDraft, string>>
type ValidationResult = { valid: true; data: MenuItemInput } | { valid: false; errors: FieldErrors }

const props = defineProps<{
  restaurant: Restaurant
}>()

const restaurantStore = useRestaurantStore()
const toast = useToast()

const searchQuery = ref('')
const sortBy = ref<MenuSortKey>('name')
const sortDirection = ref<SortDirection>('asc')
const newItem = ref<MenuDraft>(createEmptyDraft())
const newErrors = ref<FieldErrors>({})
const editId = ref<string | null>(null)
const editItem = ref<MenuDraft>(createEmptyDraft())
const editErrors = ref<FieldErrors>({})
const operationKey = ref('')

const enabledCategories = computed(() =>
  [...restaurantStore.activeCategories].sort((left, right) =>
    left.name.localeCompare(right.name, 'zh-TW'),
  ),
)

const editCategoryOptions = computed(() => {
  const currentCategory = restaurantStore.getCategoryById(editItem.value.categoryId)
  if (!currentCategory || currentCategory.enabled) {
    return enabledCategories.value
  }
  return [currentCategory, ...enabledCategories.value]
})

const sortedItems = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const direction = sortDirection.value === 'asc' ? 1 : -1

  return props.restaurant.menuItems
    .filter((item) => {
      if (!query) return true
      return [item.name, categoryName(item.categoryId)].some((value) =>
        value.toLowerCase().includes(query),
      )
    })
    .sort((left, right) => {
      if (sortBy.value === 'price') {
        return (left.price - right.price) * direction
      }
      if (sortBy.value === 'enabled') {
        return (Number(left.enabled) - Number(right.enabled)) * direction
      }
      const leftValue = sortBy.value === 'category' ? categoryName(left.categoryId) : left.name
      const rightValue = sortBy.value === 'category' ? categoryName(right.categoryId) : right.name
      return leftValue.localeCompare(rightValue, 'zh-TW') * direction
    })
})

function createEmptyDraft(): MenuDraft {
  return {
    name: '',
    price: null,
    categoryId: restaurantStore.activeCategories[0]?.id ?? '',
  }
}

function categoryName(categoryId: string): string {
  return restaurantStore.getCategoryById(categoryId)?.name ?? '未分類'
}

function validate(draft: MenuDraft, allowedCategoryIds: Set<string>): ValidationResult {
  const errors: FieldErrors = {}
  let price: number | undefined

  if (!draft.name.trim()) {
    errors.name = '請輸入餐點名稱'
  }
  if (typeof draft.price === 'number' && Number.isInteger(draft.price) && draft.price > 0) {
    price = draft.price
  } else {
    errors.price = '價格必須為大於 0 的整數'
  }
  if (!allowedCategoryIds.has(draft.categoryId)) {
    errors.categoryId = '請選擇餐點分類'
  }
  if (Object.keys(errors).length > 0 || price === undefined) {
    return { valid: false, errors }
  }
  return {
    valid: true,
    data: {
      name: draft.name.trim(),
      price,
      categoryId: draft.categoryId,
    },
  }
}

async function addMenuItem() {
  const validation = validate(
    newItem.value,
    new Set(enabledCategories.value.map((category) => category.id)),
  )
  if (!validation.valid) {
    newErrors.value = validation.errors
    return
  }
  newErrors.value = {}

  operationKey.value = 'create'
  try {
    await restaurantStore.addMenuItem(props.restaurant.id, validation.data)
    newItem.value = createEmptyDraft()
    toast.success('餐點已新增')
  } catch (error) {
    toast.error(getErrorMessage(error, '新增餐點失敗'))
  } finally {
    operationKey.value = ''
  }
}

function startEdit(item: MenuItem) {
  editId.value = item.id
  editItem.value = {
    name: item.name,
    price: item.price,
    categoryId: item.categoryId,
  }
  editErrors.value = {}
}

function cancelEdit() {
  editId.value = null
  editErrors.value = {}
}

async function saveMenuItem() {
  if (!editId.value) return

  const validation = validate(
    editItem.value,
    new Set(editCategoryOptions.value.map((category) => category.id)),
  )
  if (!validation.valid) {
    editErrors.value = validation.errors
    return
  }
  editErrors.value = {}

  operationKey.value = `edit:${editId.value}`
  try {
    await restaurantStore.updateMenuItem(props.restaurant.id, editId.value, validation.data)
    cancelEdit()
    toast.success('餐點資料已更新')
  } catch (error) {
    toast.error(getErrorMessage(error, '更新餐點失敗'))
  } finally {
    operationKey.value = ''
  }
}

async function toggleEnabled(item: MenuItem) {
  operationKey.value = `toggle:${item.id}`
  try {
    await restaurantStore.setMenuItemEnabled(props.restaurant.id, item.id, !item.enabled)
    toast.success(item.enabled ? '餐點已停用' : '餐點已啟用')
  } catch (error) {
    toast.error(getErrorMessage(error, '更新餐點狀態失敗'))
  } finally {
    operationKey.value = ''
  }
}

async function deleteMenuItem(item: MenuItem) {
  if (!confirm(`確定要刪除餐點「${item.name}」？`)) return

  operationKey.value = `delete:${item.id}`
  try {
    await restaurantStore.deleteMenuItem(props.restaurant.id, item.id)
    if (editId.value === item.id) {
      cancelEdit()
    }
    toast.success('餐點已刪除')
  } catch (error) {
    toast.error(getErrorMessage(error, '刪除餐點失敗'))
  } finally {
    operationKey.value = ''
  }
}
</script>

<template>
  <section class="menu-panel" :aria-labelledby="`menu-title-${restaurant.id}`">
    <div class="panel-heading">
      <div>
        <h3 :id="`menu-title-${restaurant.id}`">餐點管理</h3>
        <p>設定餐點價格、分類與供應狀態。</p>
      </div>
      <span class="result-count">
        {{ sortedItems.length }} / {{ restaurant.menuItems.length }} 項
      </span>
    </div>

    <form class="menu-form" @submit.prevent="addMenuItem">
      <div class="field name-field">
        <label :for="`new-menu-name-${restaurant.id}`">餐點名稱</label>
        <input
          :id="`new-menu-name-${restaurant.id}`"
          v-model="newItem.name"
          class="form-input"
          :class="{ invalid: newErrors.name }"
          type="text"
          placeholder="餐點名稱"
          :disabled="restaurantStore.loading"
          @input="newErrors.name = ''"
        />
        <p v-if="newErrors.name" class="field-error">{{ newErrors.name }}</p>
      </div>
      <div class="field price-field">
        <label :for="`new-menu-price-${restaurant.id}`">價格</label>
        <input
          :id="`new-menu-price-${restaurant.id}`"
          v-model.number="newItem.price"
          class="form-input"
          :class="{ invalid: newErrors.price }"
          type="number"
          min="1"
          step="1"
          placeholder="0"
          :disabled="restaurantStore.loading"
          @input="newErrors.price = ''"
        />
        <p v-if="newErrors.price" class="field-error">{{ newErrors.price }}</p>
      </div>
      <div class="field category-field">
        <label :for="`new-menu-category-${restaurant.id}`">分類</label>
        <select
          :id="`new-menu-category-${restaurant.id}`"
          v-model="newItem.categoryId"
          class="form-select"
          :class="{ invalid: newErrors.categoryId }"
          :disabled="restaurantStore.loading || enabledCategories.length === 0"
          @change="newErrors.categoryId = ''"
        >
          <option value="" disabled>請選擇</option>
          <option v-for="category in enabledCategories" :key="category.id" :value="category.id">
            {{ category.name }}
          </option>
        </select>
        <p v-if="newErrors.categoryId" class="field-error">{{ newErrors.categoryId }}</p>
      </div>
      <button
        class="btn btn-primary btn-sm"
        type="submit"
        :disabled="restaurantStore.loading || enabledCategories.length === 0"
      >
        {{ operationKey === 'create' ? '新增中…' : '＋ 新增餐點' }}
      </button>
    </form>

    <p v-if="enabledCategories.length === 0" class="panel-warning">
      尚無已啟用的餐點分類，請先至「餐點分類」新增或啟用分類。
    </p>

    <div class="menu-toolbar">
      <input
        v-model="searchQuery"
        class="form-input"
        type="search"
        placeholder="搜尋餐點或分類…"
        aria-label="搜尋餐點或分類"
        :disabled="restaurantStore.loading"
      />
      <select
        v-model="sortBy"
        class="form-select"
        aria-label="餐點排序欄位"
        :disabled="restaurantStore.loading"
      >
        <option value="name">依名稱排序</option>
        <option value="category">依分類排序</option>
        <option value="price">依價格排序</option>
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

    <div v-if="restaurant.menuItems.length === 0" class="menu-empty">尚無餐點，請由上方新增。</div>
    <div v-else-if="sortedItems.length === 0" class="menu-empty">找不到符合條件的餐點。</div>

    <div v-else class="table-wrapper">
      <table class="menu-table">
        <thead>
          <tr>
            <th>餐點名稱</th>
            <th>分類</th>
            <th>價格</th>
            <th>狀態</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in sortedItems" :key="item.id" :class="{ muted: !item.enabled }">
            <template v-if="editId === item.id">
              <td>
                <input
                  v-model="editItem.name"
                  class="form-input table-input"
                  :class="{ invalid: editErrors.name }"
                  aria-label="餐點名稱"
                  :disabled="restaurantStore.loading"
                  @input="editErrors.name = ''"
                />
                <p v-if="editErrors.name" class="field-error">{{ editErrors.name }}</p>
              </td>
              <td>
                <select
                  v-model="editItem.categoryId"
                  class="form-select table-input"
                  :class="{ invalid: editErrors.categoryId }"
                  aria-label="餐點分類"
                  :disabled="restaurantStore.loading"
                  @change="editErrors.categoryId = ''"
                >
                  <option
                    v-for="category in editCategoryOptions"
                    :key="category.id"
                    :value="category.id"
                  >
                    {{ category.name }}{{ category.enabled ? '' : '（已停用）' }}
                  </option>
                </select>
                <p v-if="editErrors.categoryId" class="field-error">
                  {{ editErrors.categoryId }}
                </p>
              </td>
              <td>
                <input
                  v-model.number="editItem.price"
                  class="form-input price-input"
                  :class="{ invalid: editErrors.price }"
                  type="number"
                  min="1"
                  step="1"
                  aria-label="餐點價格"
                  :disabled="restaurantStore.loading"
                  @input="editErrors.price = ''"
                />
                <p v-if="editErrors.price" class="field-error">{{ editErrors.price }}</p>
              </td>
              <td>
                <span class="status-badge" :class="{ off: !item.enabled }">
                  {{ item.enabled ? '已啟用' : '已停用' }}
                </span>
              </td>
              <td>
                <div class="actions">
                  <button
                    class="btn btn-sm btn-primary"
                    type="button"
                    :disabled="restaurantStore.loading"
                    @click="saveMenuItem"
                  >
                    {{ operationKey === `edit:${item.id}` ? '儲存中…' : '儲存' }}
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
              </td>
            </template>

            <template v-else>
              <td>{{ item.name }}</td>
              <td>
                <span class="category-badge">{{ categoryName(item.categoryId) }}</span>
              </td>
              <td class="price">{{ item.price }} 元</td>
              <td>
                <span class="status-badge" :class="{ off: !item.enabled }">
                  {{ item.enabled ? '已啟用' : '已停用' }}
                </span>
              </td>
              <td>
                <div class="actions">
                  <button
                    class="btn btn-sm"
                    :class="item.enabled ? 'btn-secondary' : 'btn-info'"
                    type="button"
                    :disabled="restaurantStore.loading"
                    @click="toggleEnabled(item)"
                  >
                    {{
                      operationKey === `toggle:${item.id}`
                        ? '更新中…'
                        : item.enabled
                          ? '停用'
                          : '啟用'
                    }}
                  </button>
                  <button
                    class="btn btn-sm btn-secondary"
                    type="button"
                    :disabled="restaurantStore.loading"
                    @click="startEdit(item)"
                  >
                    編輯
                  </button>
                  <button
                    class="btn btn-sm btn-danger"
                    type="button"
                    :disabled="restaurantStore.loading"
                    @click="deleteMenuItem(item)"
                  >
                    {{ operationKey === `delete:${item.id}` ? '刪除中…' : '刪除' }}
                  </button>
                </div>
              </td>
            </template>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.menu-panel {
  padding: 18px;
  background: #fff;
  border-top: 1px solid #e2e8f0;
}

.panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.panel-heading h3 {
  color: #2d3748;
  font-size: 1rem;
}

.panel-heading p,
.result-count {
  color: #718096;
  font-size: 0.82rem;
}

.menu-form {
  display: grid;
  grid-template-columns: minmax(150px, 2fr) minmax(100px, 0.7fr) minmax(140px, 1fr) auto;
  align-items: start;
  gap: 8px;
  margin-bottom: 12px;
  padding: 12px;
  background: #f7fafc;
  border-radius: 6px;
}

.field label {
  display: block;
  margin-bottom: 4px;
  color: #4a5568;
  font-size: 0.78rem;
  font-weight: 600;
}

.field .form-input,
.field .form-select {
  width: 100%;
}

.menu-form > .btn {
  margin-top: 23px;
}

.field-error {
  margin-top: 3px;
  color: #c53030;
  font-size: 0.76rem;
  white-space: normal;
}

.invalid {
  border-color: #e53e3e;
}

.panel-warning {
  margin-bottom: 12px;
  padding: 8px 10px;
  color: #975a16;
  font-size: 0.82rem;
  background: #fffaf0;
  border: 1px solid #fbd38d;
  border-radius: 5px;
}

.menu-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.menu-toolbar .form-input {
  flex: 1;
  min-width: 140px;
}

.menu-empty {
  padding: 20px;
  color: #718096;
  text-align: center;
  background: #f8fafc;
  border: 1px dashed #cbd5e0;
  border-radius: 6px;
}

.menu-table {
  min-width: 720px;
  box-shadow: none;
  border: 1px solid #edf2f7;
}

.menu-table th {
  background: #4a5568;
}

.menu-table tr.muted td {
  color: #718096;
  background: #f7fafc;
}

.table-input {
  width: 100%;
  min-width: 110px;
}

.price-input {
  width: 90px;
}

.category-badge,
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  font-size: 0.76rem;
  border-radius: 999px;
  white-space: nowrap;
}

.category-badge {
  color: #2c5282;
  background: #ebf8ff;
}

.status-badge {
  color: #276749;
  font-weight: 600;
  background: #c6f6d5;
}

.status-badge.off {
  color: #4a5568;
  background: #e2e8f0;
}

.price {
  color: #c53030;
  font-weight: 600;
  white-space: nowrap;
}

.actions {
  display: flex;
  gap: 5px;
  white-space: nowrap;
}

@media (max-width: 820px) {
  .menu-form {
    grid-template-columns: 1fr 1fr;
  }

  .name-field {
    grid-column: 1 / -1;
  }

  .menu-form > .btn {
    align-self: end;
    margin-top: 23px;
  }
}

@media (max-width: 600px) {
  .menu-panel {
    padding: 14px 10px;
  }

  .menu-form {
    grid-template-columns: 1fr;
  }

  .name-field {
    grid-column: auto;
  }

  .menu-form > .btn {
    width: 100%;
    margin-top: 0;
  }

  .menu-toolbar {
    flex-direction: column;
  }

  .menu-toolbar .form-input,
  .menu-toolbar .form-select,
  .menu-toolbar .btn {
    width: 100%;
  }
}
</style>
