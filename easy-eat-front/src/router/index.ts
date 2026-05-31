import { createRouter, createWebHistory } from 'vue-router'
import OrderListView from '../views/OrderListView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'order-list',
      component: OrderListView,
    },
    {
      path: '/orders/add',
      name: 'order-add',
      component: () => import('../views/OrderAddView.vue'),
    },
    {
      path: '/orders/:id',
      name: 'order-detail',
      component: () => import('../views/OrderDetailView.vue'),
    },
    {
      path: '/statistics',
      name: 'statistics',
      component: () => import('../views/MealStatisticsView.vue'),
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('../views/AdminView.vue'),
    },
  ],
})

export default router
