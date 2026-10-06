<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: 'sm' | 'md' | 'lg'
    label?: string
  }>(),
  {
    size: 'md',
    label: '載入中',
  },
)
</script>

<template>
  <div :class="['loading-spinner', `loading-spinner--${size}`]" role="status" :aria-label="label" />
</template>

<style scoped>
.loading-spinner {
  border-radius: 50%;
  border: 3px solid #e0e0e0;
  border-top-color: #3498db;
  animation: loading-spin 0.8s linear infinite;
}

.loading-spinner--sm {
  width: 20px;
  height: 20px;
  border-width: 2px;
}

.loading-spinner--md {
  width: 36px;
  height: 36px;
  border-width: 3px;
}

.loading-spinner--lg {
  width: 56px;
  height: 56px;
  border-width: 4px;
}

@keyframes loading-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
