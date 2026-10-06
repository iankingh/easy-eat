import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

describe('LoadingSpinner', () => {
  it('renders with default size md', () => {
    const wrapper = mount(LoadingSpinner)
    expect(wrapper.classes()).toContain('loading-spinner')
    expect(wrapper.classes()).toContain('loading-spinner--md')
  })

  it('renders with small size', () => {
    const wrapper = mount(LoadingSpinner, {
      props: { size: 'sm' },
    })
    expect(wrapper.classes()).toContain('loading-spinner')
    expect(wrapper.classes()).toContain('loading-spinner--sm')
  })

  it('renders with large size', () => {
    const wrapper = mount(LoadingSpinner, {
      props: { size: 'lg' },
    })
    expect(wrapper.classes()).toContain('loading-spinner')
    expect(wrapper.classes()).toContain('loading-spinner--lg')
  })
})
