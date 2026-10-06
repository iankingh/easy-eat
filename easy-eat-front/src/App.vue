<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from '@/components/AppSidebar.vue'
import ToastNotification from '@/components/ToastNotification.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import { useOrderStore } from '@/stores/order'
import { useRestaurantStore } from '@/stores/restaurant'

const orderStore = useOrderStore()
const restaurantStore = useRestaurantStore()

const bootstrapping = ref(true)
const appError = computed(
  () =>
    (!orderStore.initialized && orderStore.errorMessage) ||
    (!restaurantStore.initialized && restaurantStore.errorMessage),
)

onMounted(() => {
  void initializeApp()
})

async function initializeApp() {
  await Promise.allSettled([restaurantStore.initialize(), orderStore.initialize()])
  bootstrapping.value = false
}
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <h1>🍽 訂餐系統</h1>
    </header>
    <div class="app-body">
      <AppSidebar />
      <main class="app-main" :aria-busy="bootstrapping">
        <div v-if="bootstrapping" class="app-status">
          <LoadingSpinner label="應用程式資料載入中" />
        </div>
        <div v-else-if="appError" class="app-status app-status-error" role="alert">
          {{ appError }}
        </div>
        <RouterView v-else />
      </main>
    </div>
    <footer class="app-footer">
      <p>版權所有 &copy; 2026 - 訂餐系統</p>
    </footer>
  </div>
  <ToastNotification />
</template>

<style scoped>
.app-status {
  margin-bottom: 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: #eef4fb;
  color: #2c3e50;
  font-size: 0.9rem;
}

.app-status-error {
  background: #fdecea;
  color: #c0392b;
}
</style>
