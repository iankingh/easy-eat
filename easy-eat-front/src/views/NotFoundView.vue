<template>
  <section class="page-section">
    <div class="not-found-card">
      <div class="error-code">404</div>
      <h1>找不到此頁面</h1>
      <p>您前往的頁面不存在，或網址已經變更。</p>
      <RouterLink :to="{ name: 'order-list' }" class="btn btn-primary">返回訂單清單</RouterLink>
    </div>
  </section>
</template>

<style scoped>
.not-found-card {
  display: flex;
  min-height: 360px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fff;
  text-align: center;
}

.error-code {
  color: #4a90d9;
  font-size: 4rem;
  font-weight: bold;
  line-height: 1;
}

h1 {
  color: #2c3e50;
  font-size: 1.5rem;
}

p {
  margin-bottom: 8px;
  color: #666;
}
</style>
