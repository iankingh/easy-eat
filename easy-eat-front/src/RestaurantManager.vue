<script setup lang="ts">
import { ref, watch } from 'vue'
import { api, money } from './api'
import type { Catalog, MenuItem } from './types'
const props = defineProps<{ adminCode: string; restaurantId: string; busy: boolean }>()
const emit = defineEmits<{
  select: [id: string]
  success: [message: string]
  error: [error: unknown]
  busy: [value: boolean]
}>()
const catalog = ref<Catalog | null>(null),
  loading = ref(false),
  name = ref('')
const empty = () => ({ name: '', description: '', price: '' })
const meal = ref(empty()),
  editing = ref<(ReturnType<typeof empty> & { id: number }) | null>(null),
  removing = ref<number | null>(null)
let version = 0
async function load(id = props.restaurantId) {
  const current = ++version
  loading.value = true
  try {
    const result = await api<Catalog>(
      `?view=restaurants${id ? `&restaurantId=${encodeURIComponent(id)}` : ''}`,
      undefined,
      props.adminCode,
    )
    if (current === version) catalog.value = result
  } finally {
    if (current === version) loading.value = false
  }
}
watch(
  () => props.restaurantId,
  () => {
    editing.value = null
    meal.value = empty()
    removing.value = null
    void load().catch((error) => emit('error', error))
  },
  { immediate: true },
)
async function save(body: Record<string, unknown>, message: string) {
  if (props.busy) return
  emit('busy', true)
  try {
    const result = await api<{ restaurantId?: number }>('', body, props.adminCode)
    if (result.restaurantId) {
      name.value = ''
      emit('select', String(result.restaurantId))
    }
    meal.value = empty()
    editing.value = null
    removing.value = null
    try {
      await load(String(result.restaurantId || catalog.value?.restaurant?.id || ''))
    } catch {
      emit('success', `${message} 最新菜單未能載入，請重新載入確認，請勿重複新增。`)
      return
    }
    emit('success', message)
  } catch (error) {
    emit('error', error)
  } finally {
    emit('busy', false)
  }
}
function edit(item: Omit<MenuItem, 'available'>) {
  editing.value = { ...item, price: String(item.price) }
  removing.value = null
}
</script>
<template>
  <div class="catalog-layout">
    <section class="panel">
      <div class="section-top">
        <h2>餐廳列表</h2>
        <button :disabled="busy" @click="load().catch((error) => emit('error', error))">
          重新載入
        </button>
      </div>
      <div class="restaurant-list">
        <button
          v-for="store in catalog?.restaurants"
          :key="store.id"
          :aria-pressed="catalog?.restaurant?.id === store.id"
          :disabled="busy"
          @click="emit('select', String(store.id))"
        >
          <strong>{{ store.name }}</strong
          ><span>{{ store.menuCount }} 項餐點</span>
        </button>
        <p v-if="!loading && !catalog?.restaurants.length" class="muted">
          還沒有餐廳，請先在下方新增。
        </p>
      </div>
      <form
        class="separated"
        @submit.prevent="
          save({ action: 'create-restaurant', name }, '餐廳已新增，可以開始輸入菜單。')
        "
      >
        <h3>自訂新增餐廳</h3>
        <label
          >餐廳名稱<input v-model="name" required maxlength="100" placeholder="例如：小巷健康餐"
        /></label>
        <button class="primary wide" :disabled="busy">新增餐廳</button>
      </form>
    </section>
    <section class="panel" :aria-busy="loading">
      <p v-if="loading" role="status">正在載入餐廳菜單…</p>
      <template v-else-if="catalog?.restaurant">
        <h2>{{ catalog.restaurant.name }} · 菜單管理</h2>
        <p class="muted">
          這份菜單會保存在餐廳中，每次開團都可沿用。已送出的訂單會保留原名稱與價格。
        </p>
        <form
          class="meal-form"
          @submit.prevent="
            save(
              {
                action: 'add-menu-item',
                restaurantId: catalog.restaurant.id,
                ...meal,
                price: Number(meal.price),
              },
              '餐點已加入這家餐廳的菜單。',
            )
          "
        >
          <h3>自訂輸入餐點</h3>
          <div class="form-grid">
            <label>餐點名稱<input v-model="meal.name" required maxlength="80" /></label
            ><label>說明（選填）<input v-model="meal.description" maxlength="160" /></label
            ><label
              >價格<input v-model="meal.price" required type="number" min="1" max="10000"
            /></label>
          </div>
          <button class="primary" :disabled="busy">新增餐點</button>
        </form>
        <div v-for="item in catalog.menu" :key="item.id" class="meal-row">
          <form
            v-if="editing?.id === item.id"
            @submit.prevent="
              save(
                {
                  action: 'update-menu-item',
                  restaurantId: catalog.restaurant.id,
                  menuItemId: editing.id,
                  ...editing,
                  price: Number(editing.price),
                },
                '餐點已更新，已送出的訂單保留原內容。',
              )
            "
          >
            <div class="form-grid">
              <label>餐點名稱<input v-model="editing.name" required maxlength="80" /></label
              ><label>說明<input v-model="editing.description" maxlength="160" /></label
              ><label
                >價格<input v-model="editing.price" required type="number" min="1" max="10000"
              /></label>
            </div>
            <div class="actions">
              <button class="primary" :disabled="busy">儲存餐點</button
              ><button type="button" @click="editing = null">取消編輯</button>
            </div>
          </form>
          <div v-else class="row">
            <div>
              <strong>{{ item.name }}　{{ money(item.price) }}</strong>
              <p class="muted">{{ item.description }}</p>
            </div>
            <div class="actions">
              <button :disabled="busy" @click="edit(item)">編輯</button
              ><button :disabled="busy" @click="removing = item.id">移除</button>
            </div>
          </div>
          <div v-if="removing === item.id" class="notice error">
            <p>確定移除「{{ item.name }}」？已送出訂單會保留。</p>
            <div class="actions">
              <button
                class="danger"
                :disabled="busy"
                @click="
                  save(
                    {
                      action: 'remove-menu-item',
                      restaurantId: catalog.restaurant.id,
                      menuItemId: item.id,
                    },
                    '餐點已移除。',
                  )
                "
              >
                確認移除</button
              ><button @click="removing = null">取消</button>
            </div>
          </div>
        </div>
        <p v-if="!catalog.menu.length" class="notice">
          菜單尚無餐點，請在上方輸入名稱與價格。保存後開團就不必再輸入一次。
        </p>
      </template>
      <template v-else
        ><h2>先新增餐廳，再輸入菜單</h2>
        <p class="muted">餐廳與菜單可獨立保存，準備完成後再到訂單管理開團。</p></template
      >
    </section>
  </div>
</template>
