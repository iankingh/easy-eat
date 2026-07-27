<script setup lang="ts">
import { ORDER_STATUS_LABELS } from '@/constants/order'
import type { OrderStatus } from '@/types/order'

defineProps<{
  status: OrderStatus
}>()
</script>

<template>
  <span class="status-badge" :class="`status-${status}`">
    {{ ORDER_STATUS_LABELS[status] }}
  </span>
</template>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 2px 9px;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
}

.status-draft {
  background: #e9ecef;
  color: #495057;
}

.status-pending {
  background: #fef3cd;
  color: #856404;
}

.status-completed {
  background: #d4edda;
  color: #155724;
}

.status-cancelled {
  background: #f8d7da;
  color: #721c24;
}
</style>
