<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppSidebar from './components/AppSidebar.vue'
import ToastNotification from './components/ToastNotification.vue'
import { useOrderStore } from './stores/order'
import { useRestaurantStore } from './stores/restaurant'

const orderStore = useOrderStore()
const restaurantStore = useRestaurantStore()

const appLoading = computed(() => !orderStore.initialized || !restaurantStore.initialized)
const appError = computed(() => orderStore.errorMessage || restaurantStore.errorMessage)

onMounted(async () => {
  try {
    await Promise.all([restaurantStore.initialize(), orderStore.initialize()])
  } catch (error) {
    console.error(error)
  }
})
</script>

<template>
  <div class="app-layout">
    <header class="app-header">
      <h1>🍽 訂餐系統</h1>
    </header>
    <div class="app-body">
      <AppSidebar />
      <main class="app-main">
        <div v-if="appLoading" class="app-status">資料載入中...</div>
        <div v-else-if="appError" class="app-status app-status-error">{{ appError }}</div>
        <RouterView />
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
