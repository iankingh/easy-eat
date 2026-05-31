<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <nav class="sidebar">
    <ul>
      <li>
        <RouterLink to="/">所有訂餐清單</RouterLink>
      </li>
      <li>
        <RouterLink to="/orders/add">新增訂餐</RouterLink>
      </li>
      <li>
        <RouterLink to="/statistics">訂單餐點統計表</RouterLink>
      </li>
      <li>
        <RouterLink to="/admin">後台設定</RouterLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.sidebar {
  background-color: #f2f2f2;
  width: 220px;
  min-width: 220px;
  padding: 20px;
}

.sidebar ul {
  list-style: none;
  margin: 0;
  padding: 0;
}

.sidebar li {
  margin-bottom: 10px;
}

.sidebar a {
  display: block;
  padding: 10px 14px;
  background-color: #fff;
  color: #333;
  text-decoration: none;
  border-radius: 4px;
  border-left: 3px solid transparent;
  transition: all 0.2s;
}

.sidebar a:hover {
  background-color: #e8f0fe;
  border-left-color: #4a90d9;
  color: #4a90d9;
}

.sidebar a.router-link-active {
  background-color: #4a90d9;
  color: #fff;
  border-left-color: #2c6fad;
}
</style>
