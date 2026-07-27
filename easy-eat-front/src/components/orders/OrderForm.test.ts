import { createPinia, setActivePinia } from 'pinia'
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import OrderForm from '@/components/orders/OrderForm.vue'
import { useRestaurantStore } from '@/stores/restaurant'
import type { OrderItem } from '@/types/order'

function createWrapper(
  props: {
    mode?: 'create' | 'edit'
    orderStatus?: 'draft' | 'pending'
    initialRestaurantId?: string
    initialItems?: OrderItem[]
  } = {},
) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const restaurantStore = useRestaurantStore()
  restaurantStore.categories = [{ id: 'c1', name: '食物', enabled: true }]
  restaurantStore.restaurants = [
    {
      id: 'r1',
      name: '測試餐廳',
      enabled: true,
      menuItems: [
        {
          id: 'm1',
          name: '測試餐點',
          price: 100,
          categoryId: 'c1',
          enabled: true,
        },
        {
          id: 'm2',
          name: '停用餐點',
          price: 80,
          categoryId: 'c1',
          enabled: false,
        },
      ],
    },
    {
      id: 'r2',
      name: '停用餐廳',
      enabled: false,
      menuItems: [],
    },
  ]

  return mount(OrderForm, {
    props,
    global: {
      plugins: [pinia],
      stubs: {
        RouterLink: {
          template: '<a><slot /></a>',
        },
      },
    },
  })
}

describe('OrderForm', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('emits a valid draft payload and hides disabled choices', async () => {
    const wrapper = createWrapper()
    const selects = wrapper.findAll('select')

    expect(selects[0].findAll('option').map((option) => option.text())).not.toContain('停用餐廳')

    await selects[0].setValue('r1')
    const itemSelect = wrapper.findAll('select')[1]
    expect(itemSelect.findAll('option').map((option) => option.text())).not.toContain('停用餐點')

    await itemSelect.setValue('m1')
    const draftButton = wrapper
      .findAll('button')
      .find((button) => button.text().includes('儲存草稿'))
    await draftButton?.trigger('click')

    const emitted = wrapper.emitted('saveDraft')
    expect(emitted).toHaveLength(1)
    expect(emitted?.[0]?.[0]).toMatchObject({
      restaurantId: 'r1',
      items: [{ menuItemId: 'm1', quantity: 1, price: 100 }],
    })
  })

  it('shows validation errors instead of emitting an invalid order', async () => {
    const wrapper = createWrapper()
    await wrapper.find('form').trigger('submit')

    expect(wrapper.text()).toContain('請選擇餐廳')
    expect(wrapper.emitted('submit')).toBeUndefined()
  })

  it('submitting a pending edit emits save rather than submit', async () => {
    const wrapper = createWrapper({
      mode: 'edit',
      orderStatus: 'pending',
      initialRestaurantId: 'r1',
      initialItems: [
        {
          menuItemId: 'm1',
          name: '測試餐點',
          price: 100,
          quantity: 2,
          note: '',
        },
      ],
    })

    await wrapper.find('form').trigger('submit')

    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('submit')).toBeUndefined()
  })
})
