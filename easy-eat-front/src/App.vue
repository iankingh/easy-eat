<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import RestaurantManager from './RestaurantManager.vue'
import { registerOrderingTools } from './webmcp'
import { api, ApiError, money, today, formatTime } from './api'
import type { Snapshot, Round, Receipt } from './types'
type View = 'home' | 'list' | 'order' | 'admin'
const tab = ref<View>('home'),
  section = ref<'orders' | 'restaurants'>('orders'),
  roundId = ref(''),
  restaurantId = ref('')
const data = ref<Snapshot | null>(null),
  openRounds = ref<Round[]>([]),
  loading = ref(false),
  busy = ref(false),
  adminReady = ref(false),
  adminCode = ref('')
const message = ref(''),
  isError = ref(false),
  refreshWarning = ref(''),
  clock = ref(Date.now())
const groupTitle = ref(''),
  deadline = ref('10:30'),
  newRound = ref(newRoundDefaults()),
  createDetails = ref<HTMLDetailsElement | null>(null)
const employeeName = ref(''),
  account = ref(''),
  note = ref(''),
  quantities = ref<Record<number, number>>({})
const receipt = ref<Receipt | null>(null),
  mode = ref<'new' | 'append' | 'replace'>('new'),
  duplicate = ref(false)
let loadVersion = 0,
  pending: { fingerprint: string; requestId: string } | null = null,
  timer: ReturnType<typeof setInterval>,
  poll: ReturnType<typeof setInterval>
const orderOpen = computed(
  () => data.value?.round.status === 'open' && Date.parse(data.value.round.closesAt) > clock.value,
)
const visibleRounds = computed(() =>
  openRounds.value.filter((round) => Date.parse(round.closesAt) > clock.value),
)
const selected = computed(() =>
  Object.entries(quantities.value)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ menuItemId: Number(id), quantity })),
)
const selectedTotal = computed(() =>
  selected.value.reduce(
    (total, item) =>
      total +
      item.quantity * (data.value?.menu.find((meal) => meal.id === item.menuItemId)?.price || 0),
    0,
  ),
)
const unavailable = computed(() =>
  selected.value.filter(
    (item) => !data.value?.menu.some((meal) => meal.id === item.menuItemId && meal.available),
  ),
)
const openingIssue = computed(() => {
  const current = data.value
  if (!current) return ''
  if (current.round.orderDate < today())
    return '這團日期已過期，請用同一家店建立新訂單，菜單會自動沿用。'
  if (current.round.restaurantId === null || groupTitle.value !== current.round.title)
    return '請先儲存店家設定，確認菜單後再開放點餐。'
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(deadline.value) ||
    Date.parse(`${current.round.orderDate}T${deadline.value}:00+08:00`) <= clock.value
  )
    return '截止時間已過期或尚未填寫，請調整為現在之後的時間。'
  if (!current.menu.some((item) => item.available))
    return '菜單尚無供應中的餐點，請先設定餐廳菜單或將餐點改為供應中。'
  return ''
})
const kitchenText = computed(() => {
  const current = data.value
  if (!current) return ''
  const meals = new Map<string, { name: string; price: number; quantity: number }>()
  for (const order of current.orders)
    for (const item of order.items) {
      const key = JSON.stringify([item.name, item.price]),
        line = meals.get(key) || { name: item.name, price: item.price, quantity: 0 }
      line.quantity += item.quantity
      meals.set(key, line)
    }
  return [
    `${current.round.title} · ${current.round.orderDate}`,
    `${current.personCount} 人 · ${current.orderCount} 筆訂單 · ${current.mealCount} 份餐點`,
    ...[...meals.values()].map(
      (item) =>
        `${item.name} (${money(item.price)}) × ${item.quantity}：${money(item.quantity * item.price)}`,
    ),
    `總計：${money(current.orderTotal)}`,
    '',
    '個別備註：',
    ...current.orders
      .filter((order) => order.note)
      .map(
        (order) =>
          `${order.name}：${order.items.map((item) => `${item.name} × ${item.quantity}`).join('、')}；${order.note}`,
      ),
  ].join('\n')
})
function newRoundDefaults() {
  const next = new Date(Date.now() + 3600000)
  return {
    title: '',
    orderDate: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Taipei' }).format(next),
    deadline: new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Taipei',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(next),
  }
}
function feedback(value: string) {
  message.value = value
  isError.value = false
}
function showError(error: unknown) {
  message.value =
    error instanceof TypeError ||
    (error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name))
      ? '連線中斷或逾時，請重新整理並確認是否已儲存，再決定是否重試。'
      : error instanceof Error
        ? error.message
        : String(error)
  isError.value = true
}
function restoreLocation() {
  const query = new URLSearchParams(location.search),
    view = query.get('view')
  tab.value =
    view === 'admin' ? 'admin' : view === 'list' ? 'list' : query.has('round') ? 'order' : 'home'
  roundId.value = query.get('round') || ''
  section.value = query.get('manage') === 'restaurants' ? 'restaurants' : 'orders'
  restaurantId.value = query.get('restaurant') || ''
  quantities.value = {}
  note.value = ''
  mode.value = 'new'
  duplicate.value = false
  message.value = ''
}
function navigate(view: View, id = '', manage: 'orders' | 'restaurants' = 'orders', store = '') {
  const url = new URL(location.href)
  url.search = ''
  if (view === 'admin' || view === 'list') url.searchParams.set('view', view)
  if (id) url.searchParams.set('round', id)
  if (view === 'admin' && manage === 'restaurants') {
    url.searchParams.set('manage', 'restaurants')
    if (store) url.searchParams.set('restaurant', store)
  }
  history.pushState({}, '', url)
  restoreLocation()
}
async function refresh(quiet = false, resetSettings = false) {
  if (quiet && (busy.value || loading.value || document.visibilityState === 'hidden')) return
  const version = ++loadVersion
  if (
    tab.value === 'home' ||
    (tab.value === 'admin' && (!adminReady.value || section.value === 'restaurants'))
  ) {
    loading.value = false
    return
  }
  if (!quiet) loading.value = true
  try {
    const query =
      tab.value === 'list'
        ? '?view=list'
        : roundId.value
          ? `?roundId=${encodeURIComponent(roundId.value)}`
          : ''
    const snapshot = await api<Snapshot>(
      query,
      undefined,
      tab.value === 'admin' && adminReady.value ? adminCode.value : '',
    )
    if (version !== loadVersion) return
    if (tab.value === 'list') openRounds.value = snapshot.rounds
    else {
      const changed = data.value?.round.id !== snapshot.round.id
      data.value = snapshot
      if (changed || resetSettings) {
        groupTitle.value = snapshot.round.title
        deadline.value = snapshot.round.closesAt.slice(11, 16)
      }
      if (changed || !receipt.value) {
        receipt.value = null
        try {
          const saved = JSON.parse(
            localStorage.getItem(`lunch-receipt-${snapshot.round.id}`) || 'null',
          ) as Receipt | null
          if (
            saved?.roundId === snapshot.round.id &&
            Array.isArray(saved.items) &&
            typeof saved.orderId === 'string'
          )
            receipt.value = saved
        } catch {
          /* Receipt storage is optional; ordering still works. */
        }
      }
    }
    refreshWarning.value = ''
    clock.value = Date.now()
  } catch (error) {
    if (version !== loadVersion) return
    if (quiet) refreshWarning.value = '最新狀態暫時無法更新，請按「重新整理」確認是否仍可點餐。'
    else {
      showError(error)
      throw error
    }
  } finally {
    if (version === loadVersion) loading.value = false
  }
}
watch([tab, roundId], ([view, id], _, onCleanup) => {
  if (view === 'order')
    onCleanup(
      registerOrderingTools(id, async () => {
        await refresh()
        feedback('訂單已送出。')
      }),
    )
})
watch([tab, roundId, adminReady, section], () => {
  void refresh(false, true).catch(() => {})
})
async function run(body: Record<string, unknown>, success: string) {
  if (busy.value) return null
  busy.value = true
  message.value = ''
  try {
    const result = await api<{ roundId?: number }>('', body, adminCode.value)
    try {
      await refresh(false, true)
    } catch {
      feedback(`${success} 最新資料未能載入，請重新整理確認，請勿重複操作。`)
      return result
    }
    feedback(success)
    return result
  } catch (error) {
    showError(error)
    return null
  } finally {
    busy.value = false
  }
}
async function login() {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    await api('', { action: 'admin-check' }, adminCode.value)
    adminReady.value = true
    feedback('管理碼驗證成功，後台已解鎖。')
  } catch (error) {
    showError(error)
  } finally {
    busy.value = false
  }
}
async function createRound() {
  const result = await run(
    { action: 'create-round', ...newRound.value },
    '新團已建立，會直接使用這家店的共用菜單。',
  )
  if (result?.roundId) {
    navigate('admin', String(result.roundId))
    if (createDetails.value) createDetails.value.open = false
    newRound.value = newRoundDefaults()
    feedback('新團已建立，確認截止時間後即可開放點餐。')
  }
}
async function submitOrder() {
  if (busy.value || !data.value) return
  if (!orderOpen.value) {
    showError('這團目前關閉中或已截止。')
    return
  }
  if (unavailable.value.length) {
    showError('已選餐點包含售完或已移除項目，請移除後再送出。')
    return
  }
  const payload = {
    action: 'place-order',
    roundId: data.value.round.id,
    name: employeeName.value.trim(),
    account: account.value.trim(),
    note: note.value.trim(),
    items: selected.value,
    mode: mode.value,
    replaceOrderId: mode.value === 'replace' ? receipt.value?.orderId : '',
  }
  if (!payload.name || !payload.account || !payload.items.length) {
    showError('請填寫姓名、帳號，並選擇至少一份餐點。')
    return
  }
  const fingerprint = JSON.stringify(payload)
  if (pending?.fingerprint !== fingerprint)
    pending = { fingerprint, requestId: crypto.randomUUID() }
  busy.value = true
  message.value = ''
  try {
    const result = await api<{ orderId: string }>('', { ...payload, requestId: pending.requestId })
    const saved: Receipt = {
      orderId: result.orderId,
      roundId: payload.roundId,
      name: payload.name,
      account: payload.account,
      note: payload.note,
      items: [...payload.items],
    }
    receipt.value = saved
    try {
      localStorage.setItem(`lunch-receipt-${payload.roundId}`, JSON.stringify(saved))
    } catch {
      /* Keep the receipt in memory for this visit. */
    }
    pending = null
    quantities.value = {}
    note.value = ''
    mode.value = 'new'
    duplicate.value = false
    try {
      await refresh()
    } catch {
      feedback('訂單已送出。最新狀態未能載入，請重新整理確認，請勿重複送單。')
      return
    }
    feedback('訂單已送出，可以在此瀏覽器修改上一筆訂單。')
  } catch (error) {
    if (error instanceof ApiError && error.code === 'duplicate-order') duplicate.value = true
    showError(error)
  } finally {
    busy.value = false
  }
}
function editReceipt() {
  if (!receipt.value) return
  employeeName.value = receipt.value.name
  account.value = receipt.value.account
  note.value = receipt.value.note
  quantities.value = Object.fromEntries(
    receipt.value.items.map((item) => [item.menuItemId, item.quantity]),
  )
  mode.value = 'replace'
  duplicate.value = false
}
async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    feedback('已複製。')
  } catch {
    showError(`自動複製失敗，請手動複製：\n${text}`)
  }
}
function roundLink(id: number) {
  return `${location.origin}/?round=${id}`
}
function changeSection(value: 'orders' | 'restaurants', store = '') {
  navigate('admin', roundId.value, value, store)
}
function setBusy(value: boolean) {
  busy.value = value
  if (value) message.value = ''
}
function logout() {
  adminReady.value = false
  adminCode.value = ''
}
function cancelMode() {
  mode.value = 'new'
  duplicate.value = false
  quantities.value = {}
  note.value = ''
}
function appendMode() {
  mode.value = 'append'
  duplicate.value = false
}
function resetSettings() {
  if (data.value) {
    groupTitle.value = data.value.round.title
    deadline.value = data.value.round.closesAt.slice(11, 16)
  }
}
function printOrders() {
  window.print()
}
function visibilityRefresh() {
  if (document.visibilityState === 'visible') void refresh(true)
}
onMounted(() => {
  restoreLocation()
  void refresh(false, true).catch(() => {})
  window.addEventListener('popstate', restoreLocation)
  document.addEventListener('visibilitychange', visibilityRefresh)
  timer = setInterval(() => {
    clock.value = Date.now()
  }, 1000)
  poll = setInterval(() => {
    if (tab.value === 'list' || tab.value === 'order') void refresh(true)
  }, 30000)
})
onUnmounted(() => {
  clearInterval(timer)
  clearInterval(poll)
  window.removeEventListener('popstate', restoreLocation)
  document.removeEventListener('visibilitychange', visibilityRefresh)
})
</script>
<template>
  <main v-if="tab === 'home'" class="home">
    <div class="home-entries">
      <button class="primary" @click="navigate('list')">我要點餐</button
      ><button @click="navigate('admin')">點餐後台</button>
    </div>
  </main>
  <template v-else>
    <header>
      <div class="header-inner">
        <a href="/" class="brand" @click.prevent="navigate('home')"
          ><span class="brand-icon">點</span
          ><span><strong>點餐系統</strong><small>今天吃什麼，一起決定</small></span></a
        >
        <nav aria-label="主要功能">
          <button @click="navigate('home')">返回首頁</button
          ><button :aria-pressed="tab === 'order' || tab === 'list'" @click="navigate('list')">
            我要點餐</button
          ><button :aria-pressed="tab === 'admin'" @click="navigate('admin')">點餐後台</button>
        </nav>
      </div>
    </header>
    <main
      class="workspace"
      :class="{
        'with-aside':
          data && tab !== 'list' && (tab !== 'admin' || (adminReady && section === 'orders')),
      }"
    >
      <section class="content">
        <div class="page-heading">
          <div>
            <h1>
              {{
                tab === 'list'
                  ? '可點餐的訂單'
                  : tab === 'order'
                    ? data?.round.title || '點餐系統'
                    : '點餐後台'
              }}
            </h1>
            <p class="muted">
              {{
                tab === 'list'
                  ? '選擇一張已開放的訂單，進入店家菜單點餐。'
                  : tab === 'order'
                    ? '選好餐點、留下姓名與帳號，送出就完成。'
                    : section === 'restaurants'
                      ? '先建立餐廳與保存菜單，之後開團直接選用。'
                      : '選擇已有餐廳開團，管理各團截止時間、連結與訂單。'
              }}
            </p>
          </div>
          <button :disabled="busy || loading" @click="refresh().catch(() => {})">重新整理</button>
        </div>
        <div v-if="tab === 'admin' && adminReady" class="actions admin-tabs">
          <button :aria-pressed="section === 'orders'" @click="changeSection('orders')">
            訂單管理</button
          ><button :aria-pressed="section === 'restaurants'" @click="changeSection('restaurants')">
            餐廳／菜單管理</button
          ><button @click="logout">登出</button>
        </div>
        <div
          v-if="message"
          :role="isError ? 'alert' : 'status'"
          class="notice feedback"
          :class="{ error: isError }"
        >
          <p>{{ message }}</p>
          <button aria-label="關閉提示" @click="message = ''">關閉</button>
        </div>
        <p v-if="refreshWarning" class="notice" role="status">{{ refreshWarning }}</p>
        <p v-if="busy || loading" role="status" class="loading">
          {{ busy ? '正在儲存，請勿重複送出…' : '正在載入點餐資料…' }}
        </p>
        <template v-if="tab === 'list' && !loading"
          ><div v-if="visibleRounds.length" class="round-grid">
            <article v-for="round in visibleRounds" :key="round.id" class="panel">
              <div class="row">
                <h2>{{ round.title }}</h2>
                <span class="status open">開放中</span>
              </div>
              <p class="muted">訂單 #{{ round.id }} · {{ round.orderDate }}</p>
              <p>截止：{{ formatTime(round.closesAt) }}</p>
              <button class="primary wide" @click="navigate('order', String(round.id))">
                進入點餐
              </button>
            </article>
          </div>
          <section v-else class="panel">
            <h2>目前沒有開放點餐的訂單</h2>
            <p class="muted">管理者開放後會顯示在這裡，請稍後重新整理。</p>
          </section></template
        >
        <form v-if="tab === 'admin' && !adminReady" class="panel login" @submit.prevent="login">
          <h2>管理者登入</h2>
          <p class="muted">輸入管理碼以查看同事訂單與調整菜單。</p>
          <label
            >管理碼<input
              v-model="adminCode"
              required
              type="password"
              autocomplete="current-password" /></label
          ><button class="primary" :disabled="busy">登入管理後台</button>
        </form>
        <RestaurantManager
          v-if="tab === 'admin' && adminReady && section === 'restaurants'"
          :admin-code="adminCode"
          :restaurant-id="restaurantId"
          :busy="busy"
          @select="(id) => changeSection('restaurants', id)"
          @success="feedback"
          @error="showError"
          @busy="setBusy"
        />
        <form v-if="tab === 'order' && data" class="stack" @submit.prevent="submitOrder">
          <button type="button" class="back" @click="navigate('list')">返回訂單列表</button>
          <section class="round-banner">
            <h2>{{ orderOpen ? '開放點餐中' : '本團已截止' }}</h2>
            <p>截止時間　{{ formatTime(data.round.closesAt) }}</p>
          </section>
          <div
            v-if="receipt && (!account.trim() || receipt.account === account.trim())"
            class="notice"
          >
            <strong>此瀏覽器已保存 {{ receipt.name }} 的上一筆訂單</strong>
            <p>修改只替換這一筆；追加會保留原訂單。</p>
            <button type="button" :disabled="!orderOpen || busy" @click="editReceipt">
              修改上一筆訂單
            </button>
          </div>
          <div v-if="mode !== 'new'" class="notice">
            <p>
              {{
                mode === 'replace'
                  ? '正在修改上一筆訂單，送出後將替換原餐點。'
                  : '正在追加訂單，原訂單仍保留。'
              }}
            </p>
            <button type="button" @click="cancelMode">
              取消{{ mode === 'replace' ? '修改' : '追加' }}
            </button>
          </div>
          <div v-if="duplicate && mode === 'new'" class="notice">
            <p>這個帳號已下單，請選擇接下來的操作。</p>
            <div class="actions">
              <button type="button" class="primary" @click="appendMode">追加這份訂單</button
              ><button
                v-if="receipt?.account === account.trim()"
                type="button"
                @click="editReceipt"
              >
                修改上一筆訂單
              </button>
            </div>
          </div>
          <div v-if="unavailable.length" class="notice error">
            <p>已選餐點包含售完或已移除項目。</p>
            <button
              type="button"
              @click="unavailable.forEach((item) => delete quantities[item.menuItemId])"
            >
              移除無法供應的餐點
            </button>
          </div>
          <section class="panel">
            <h2>選擇餐點</h2>
            <div v-for="item in data.menu" :key="item.id" class="meal-choice">
              <div>
                <strong>{{ item.name }}</strong>
                <p class="muted">{{ item.description }}</p>
                <span class="price">{{ money(item.price) }}</span
                ><span v-if="!item.available" class="status">售完</span>
              </div>
              <label class="quantity"
                >數量<input
                  v-model.number="quantities[item.id]"
                  :aria-label="`${item.name} 數量`"
                  type="number"
                  min="0"
                  max="20"
                  step="1"
                  :disabled="!orderOpen || !item.available || busy"
                  placeholder="0"
              /></label>
            </div>
            <p v-if="!data.menu.length" class="muted">這團尚未設定菜單，請聯絡管理者。</p>
          </section>
          <section class="panel">
            <h2>填寫點餐資料</h2>
            <div class="form-grid identity">
              <label
                >姓名<input
                  v-model="employeeName"
                  required
                  maxlength="60"
                  autocomplete="name" /></label
              ><label
                >帳號<input v-model="account" required maxlength="80" autocomplete="username"
              /></label>
            </div>
            <label
              >備註（選填）<input
                v-model="note"
                maxlength="160"
                placeholder="例如：不要辣、飯少一點"
            /></label>
            <div class="submit-row">
              <strong>合計 {{ money(selectedTotal) }}</strong
              ><button
                class="primary"
                :disabled="busy || !orderOpen || !selected.length || !!unavailable.length"
              >
                {{ mode === 'replace' ? '送出修改' : mode === 'append' ? '追加訂單' : '送出訂單' }}
              </button>
            </div>
          </section>
        </form>
        <div v-if="tab === 'admin' && adminReady && section === 'orders' && data" class="stack">
          <section class="panel">
            <label
              >切換管理的訂單<select
                :value="data.round.id"
                @change="navigate('admin', ($event.target as HTMLSelectElement).value)"
              >
                <option
                  v-if="!data.rounds.some((round) => round.id === data!.round.id)"
                  :value="data.round.id"
                >
                  {{ data.round.title }}
                </option>
                <option v-for="round in data.rounds" :key="round.id" :value="round.id">
                  {{ round.orderDate }} · {{ round.title }} ·
                  {{ round.status === 'open' ? '開放中' : '已關閉' }}
                </option>
              </select></label
            >
          </section>
          <details ref="createDetails" class="panel">
            <summary>建立新訂單</summary>
            <form @submit.prevent="createRound">
              <div class="form-grid">
                <label
                  >選擇餐廳<select v-model="newRound.title" required>
                    <option value="">請選擇已建立的餐廳</option>
                    <option v-for="store in data.restaurants" :key="store.id" :value="store.name">
                      {{ store.name }}（{{ store.menuCount }} 項餐點）
                    </option>
                  </select></label
                ><label
                  >團購日期<input
                    v-model="newRound.orderDate"
                    type="date"
                    :min="today()"
                    required /></label
                ><label>截止時間<input v-model="newRound.deadline" type="time" required /></label>
              </div>
              <div class="actions">
                <button class="primary" :disabled="busy">建立團購</button
                ><button type="button" @click="changeSection('restaurants')">
                  自訂新增餐廳與菜單
                </button>
              </div>
              <p class="muted">開團會沿用這家店的共用菜單，不必重新輸入餐點。</p>
            </form>
          </details>
          <section class="panel">
            <div class="section-top">
              <div>
                <h2>{{ data.round.title }}</h2>
                <p class="muted">訂單 #{{ data.round.id }} · {{ data.round.orderDate }}</p>
                <span class="status" :class="{ open: data.round.status === 'open' }">{{
                  data.round.status === 'open' ? '開放點餐中' : '尚未開放／已關閉'
                }}</span>
              </div>
              <div class="actions">
                <button :disabled="busy" @click="copy(roundLink(data.round.id))">
                  複製點餐連結</button
                ><button
                  class="primary"
                  :disabled="
                    busy || !data.round.id || (data.round.status !== 'open' && !!openingIssue)
                  "
                  @click="
                    run(
                      data.round.status === 'open'
                        ? { action: 'toggle-round', roundId: data.round.id }
                        : {
                            action: 'update-round',
                            roundId: data.round.id,
                            title: groupTitle,
                            deadline,
                            openAfterSave: true,
                          },
                      '團購狀態已更新。',
                    )
                  "
                >
                  {{ data.round.status === 'open' ? '關閉點餐' : '儲存時間並開放點餐' }}
                </button>
              </div>
            </div>
            <p class="notice">{{ openingIssue || '準備完成，儲存截止時間後即可開放同事點餐。' }}</p>
            <h3>設定店家與截止時間</h3>
            <div class="actions quick-stores">
              <button
                v-for="store in data.restaurants"
                :key="store.id"
                :aria-pressed="groupTitle === store.name"
                :disabled="busy || data.orderCount > 0"
                @click="groupTitle = store.name"
              >
                {{ store.name }}</button
              ><button
                :disabled="busy || data.orderCount > 0 || !data.restaurants.length"
                @click="
                  groupTitle =
                    data.restaurants[Math.floor(Math.random() * data.restaurants.length)]?.name ||
                    ''
                "
              >
                隨機選一家
              </button>
            </div>
            <form
              @submit.prevent="
                run(
                  { action: 'update-round', roundId: data.round.id, title: groupTitle, deadline },
                  '店家與時間已儲存。',
                )
              "
            >
              <div class="form-grid identity">
                <label
                  >選擇餐廳<select v-model="groupTitle" required :disabled="data.orderCount > 0">
                    <option value="">請選擇餐廳</option>
                    <option v-for="store in data.restaurants" :key="store.id" :value="store.name">
                      {{ store.name }}
                    </option>
                  </select></label
                ><label>截止時間<input v-model="deadline" type="time" required /></label>
              </div>
              <div class="actions">
                <button class="primary" :disabled="busy || !data.round.id">儲存店家與時間</button
                ><button type="button" @click="resetSettings">還原設定</button>
              </div>
            </form>
            <p v-if="data.orderCount" class="muted">已有訂單，店家已鎖定。若要換店請建立新團。</p>
          </section>
          <section class="panel">
            <div class="section-top">
              <h2>本團餐點供應 · {{ data.round.title }}</h2>
              <button @click="changeSection('restaurants', String(data.round.restaurantId || ''))">
                管理餐廳菜單
              </button>
            </div>
            <p class="muted">這裡只調整本團供應狀態，新增與編輯餐點請到餐廳／菜單管理。</p>
            <div v-for="item in data.menu" :key="item.id" class="meal-row row">
              <div>
                <strong>{{ item.name }}　{{ money(item.price) }}</strong>
                <p class="muted">{{ item.description }}</p>
              </div>
              <button
                :disabled="busy"
                class="status"
                :class="{ open: item.available }"
                @click="
                  run(
                    { action: 'toggle-menu-item', roundId: data.round.id, menuItemId: item.id },
                    '餐點供應狀態已更新。',
                  )
                "
              >
                {{ item.available ? '供應中' : '售完' }}
              </button>
            </div>
            <p v-if="!data.menu.length" class="notice">尚無菜單，請按「管理餐廳菜單」輸入餐點。</p>
          </section>
          <section class="panel">
            <div class="section-top">
              <h2>店家出餐彙總</h2>
              <button :disabled="!data.orderCount" @click="copy(kitchenText)">複製給店家</button>
            </div>
            <pre v-if="data.orderCount">{{ kitchenText }}</pre>
            <p v-else class="muted">還沒有餐點訂單。</p>
          </section>
          <section class="panel">
            <div class="section-top">
              <h2>訂單明細</h2>
              <button @click="printOrders">列印／另存</button>
            </div>
            <p class="muted">{{ data.orderCount }} 筆訂單 · {{ money(data.orderTotal) }}</p>
            <article v-for="order in data.orders" :key="order.id" class="meal-row row">
              <div>
                <strong
                  >{{ order.name }}　<span class="muted">{{ order.account }}</span></strong
                >
                <p>{{ order.items.map((item) => `${item.name} × ${item.quantity}`).join('、') }}</p>
                <p v-if="order.note" class="muted">{{ order.note }}</p>
              </div>
              <div class="actions">
                <strong>{{ money(order.total) }}</strong
                ><button
                  :disabled="busy"
                  class="status"
                  :class="{ open: order.status === 'received' }"
                  @click="run({ action: 'toggle-order', orderId: order.id }, '訂單狀態已更新。')"
                >
                  {{ order.status === 'received' ? '已確認' : '未確認' }}
                </button>
              </div>
            </article>
            <p v-if="!data.orders.length" class="muted">還沒有同事送出訂單。</p>
          </section>
          <details class="panel">
            <summary>查看所有團購訂單與連結</summary>
            <article v-for="round in data.rounds" :key="round.id" class="meal-row row">
              <div>
                <strong
                  >{{ round.title }}　<span
                    class="status"
                    :class="{ open: round.status === 'open' }"
                    >{{ round.status === 'open' ? '開放中' : '已關閉' }}</span
                  ></strong
                >
                <p class="muted">
                  {{ round.orderDate }} · {{ round.personCount }} 人 · {{ round.orderCount }} 筆 ·
                  {{ round.mealCount }} 份 · {{ money(round.orderTotal) }}
                </p>
              </div>
              <div class="actions">
                <button @click="navigate('admin', String(round.id))">管理這團</button
                ><button @click="copy(roundLink(round.id))">複製點餐連結</button
                ><button
                  v-if="round.status === 'open'"
                  :disabled="busy"
                  @click="run({ action: 'toggle-round', roundId: round.id }, '團購已關閉。')"
                >
                  關閉訂單
                </button>
              </div>
            </article>
          </details>
        </div>
      </section>
      <aside
        v-if="data && tab !== 'list' && (tab !== 'admin' || (adminReady && section === 'orders'))"
      >
        <section class="panel">
          <h2>本團點餐狀況</h2>
          <dl>
            <div>
              <dt>訂購人數</dt>
              <dd>{{ data.personCount }} 人</dd>
            </div>
            <div>
              <dt>訂單總額</dt>
              <dd>{{ money(data.orderTotal) }}</dd>
            </div>
          </dl>
          <p class="muted">{{ data.orderCount }} 筆訂單 · {{ data.mealCount }} 份餐點</p>
          <p class="separated">
            團購狀態　<strong>{{ orderOpen ? '開放中' : '已截止' }}</strong>
          </p>
        </section>
        <section class="tip">
          <h3>點餐小提醒</h3>
          <p>
            送出前請確認姓名、帳號與餐點。此瀏覽器的上一筆訂單可在截止前修改；其他訂單請聯絡管理者。
          </p>
        </section>
      </aside>
    </main>
  </template>
</template>
