import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import type { CustomerDetail } from '@crm/domain'
import CustomerProfileCard from './CustomerProfileCard.vue'

vi.mock('@crm/domain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@crm/domain')>()),
  listDimensionOptions: vi.fn().mockResolvedValue([]),
}))

describe('客户资料阅读布局', () => {
  it('单列展示长名称及编码，不改变编辑入口', async () => {
    const customer = {
      name: '苏州清源电子材料与精密过滤设备制造有限公司',
      grade: 'S',
      status: 'active',
      relationshipStage: 'existing_customer',
      productLines: [],
      customerCode: 'ERP20260904000012',
      unifiedSocialCreditCode: '913205000000000000',
    } as unknown as CustomerDetail
    const wrapper = mount(CustomerProfileCard, {
      props: { customer, ownerLabel: '我', editable: true },
      global: { plugins: [ElementPlus] },
    })
    try {
      await flushPromises()
      expect(wrapper.getComponent({ name: 'ElDescriptions' }).props('column')).toBe(1)
      expect(wrapper.text()).toContain(customer.name)
      expect(wrapper.text()).toContain(customer.unifiedSocialCreditCode)
      expect(wrapper.text()).toContain('老客户')
      await wrapper.get('button').trigger('click')
      expect(wrapper.emitted('edit')).toHaveLength(1)
      await wrapper.setProps({ editable: false })
      expect(wrapper.find('button').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
