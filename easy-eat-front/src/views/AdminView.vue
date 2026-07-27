<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CategoryManagement from '@/components/admin/CategoryManagement.vue'
import RestaurantManagement from '@/components/admin/RestaurantManagement.vue'
import { useToast } from '@/composables/useToast'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'
import { getErrorMessage } from '@/utils/error'

const restaurantStore = useRestaurantStore()
const orderStore = useOrderStore()
const toast = useToast()

const activeSection = ref<'restaurants' | 'categories'>('restaurants')
const initializing = ref(false)
const resetting = ref(false)
const pageError = ref('')

const pageBusy = computed(
  () => initializing.value || resetting.value || restaurantStore.loading || orderStore.loading,
)

onMounted(() => {
  void initializeView()
})

async function initializeView() {
  initializing.value = true
  pageError.value = ''
  try {
    await Promise.all([restaurantStore.initialize(), orderStore.initialize()])
  } catch (error) {
    pageError.value = getErrorMessage(error, '初始化後台資料失敗，請稍後再試')
    toast.error(pageError.value)
  } finally {
    initializing.value = false
  }
}

async function resetMockData() {
  if (!confirm('確定要重置 Mock 資料嗎？這會清空現有訂單並還原預設餐廳。')) {
    return
  }

  resetting.value = true
  pageError.value = ''
  try {
    await restaurantStore.resetMockData()
    await orderStore.initialize(true)
    toast.success('Mock 資料已重置')
  } catch (error) {
    pageError.value = getErrorMessage(error, '重置 Mock 資料失敗，請稍後再試')
    toast.error(pageError.value)
  } finally {
    resetting.value = false
  }
}
</script>

<template>
  <section class="page-section admin-page" aria-labelledby="admin-title">
    <div class="section-header">
      <div>
        <h1 id="admin-title">後台設定</h1>
        <p class="page-description">管理餐廳、餐點與餐點分類。</p>
      </div>
      <button class="btn btn-secondary" type="button" :disabled="pageBusy" @click="resetMockData">
        {{ resetting ? '重置中…' : '重置 Mock 資料' }}
      </button>
    </div>

    <p v-if="pageError || restaurantStore.errorMessage" class="page-error" role="alert">
      {{ pageError || restaurantStore.errorMessage }}
    </p>

    <div v-if="initializing" class="loading-state" role="status">後台資料載入中…</div>

    <template v-else>
      <nav class="admin-tabs" aria-label="後台管理項目">
        <button
          type="button"
          class="admin-tab"
          :class="{ active: activeSection === 'restaurants' }"
          :aria-current="activeSection === 'restaurants' ? 'page' : undefined"
          @click="activeSection = 'restaurants'"
        >
          餐廳與餐點
        </button>
        <button
          type="button"
          class="admin-tab"
          :class="{ active: activeSection === 'categories' }"
          :aria-current="activeSection === 'categories' ? 'page' : undefined"
          @click="activeSection = 'categories'"
        >
          餐點分類
        </button>
      </nav>

      <RestaurantManagement v-if="activeSection === 'restaurants'" />
      <CategoryManagement v-else />
    </template>
  </section>
</template>

<style scoped>
.admin-page {
  width: 100%;
}

.section-header {
  align-items: flex-start;
}

.page-description {
  margin-top: 2px;
  color: #718096;
  font-size: 0.9rem;
}

.page-error {
  margin-bottom: 16px;
  padding: 10px 12px;
  color: #9b2c2c;
  background: #fff5f5;
  border: 1px solid #feb2b2;
  border-radius: 6px;
}

.loading-state {
  padding: 48px 24px;
  color: #718096;
  text-align: center;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.admin-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  padding: 4px;
  background: #e2e8f0;
  border-radius: 8px;
}

.admin-tab {
  flex: 1;
  padding: 9px 16px;
  color: #4a5568;
  font: inherit;
  font-weight: 600;
  background: transparent;
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.admin-tab.active {
  color: #2c5282;
  background: #fff;
  box-shadow: 0 1px 3px rgb(0 0 0 / 12%);
}

@media (max-width: 600px) {
  .section-header {
    align-items: stretch;
    flex-direction: column;
  }

  .section-header .btn {
    width: 100%;
  }
}
</style>
