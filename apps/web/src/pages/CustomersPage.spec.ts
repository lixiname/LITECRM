import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import { listCustomers } from '@crm/domain'
import CustomersPage from './CustomersPage.vue'

vi.mock('@crm/domain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@crm/domain')>()),
  useAuthStore: () => ({ user: { role: 'admin' }, hasAbility: () => true }),
  listDimensionOptions: vi.fn().mockResolvedValue([]),
  listCustomers: vi.fn(async (query: { status: string }) => ({
    items: [{ id: 'customer-1', name: '测试客户', grade: 'A', status: query.status }],
    total: 1,
    page: 1,
    pageSize: 20,
  })),
}))

describe('CustomersPage clickable rows', () => {
  it.each(['active', 'public', 'invalid'])(
    '%s 客户行标记可点击，表头不标记，点击名称进入详情',
    async (status) => {
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
      })
      await router.push('/customers')
      await router.isReady()
      const wrapper = mount(CustomersPage, { global: { plugins: [ElementPlus, router] } })
      try {
        await flushPromises()
        if (status !== 'active') {
          wrapper.getComponent({ name: 'ElSegmented' }).vm.$emit('update:modelValue', status)
          await flushPromises()
        }
        expect(listCustomers).toHaveBeenLastCalledWith(expect.objectContaining({ status }))
        expect(wrapper.findAll('.el-table__body .customers__row')).toHaveLength(1)
        expect(wrapper.find('.el-table__header .customers__row').exists()).toBe(false)
        await wrapper.get('.customers__row .customers__name').trigger('click')
        await flushPromises()
        expect(router.currentRoute.value.path).toBe('/customers/customer-1')
      } finally {
        wrapper.unmount()
      }
    },
  )
})
