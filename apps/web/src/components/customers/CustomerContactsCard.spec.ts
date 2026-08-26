import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import CustomerContactsCard from './CustomerContactsCard.vue'
import { maskPhone } from './customer-presentation'

vi.mock('@crm/domain', () => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
  removeContact: vi.fn(),
}))

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
})

describe('CustomerContactsCard', () => {
  it('脱敏展示电话，并为可编辑用户提供维护入口', async () => {
    const wrapper = mount(CustomerContactsCard, {
      attachTo: document.body,
      props: {
        customerId: 'customer-1',
        editable: true,
        contacts: [
          {
            id: 'contact-1',
            customerId: 'customer-1',
            name: '张工',
            title: '设备主管',
            phone: '13800001001',
            isKeyContact: true,
          },
        ],
      },
      global: { plugins: [ElementPlus] },
    })

    expect(wrapper.findComponent({ name: 'ElTable' }).props('data')).toHaveLength(1)
    expect(maskPhone('13800001001')).toBe('138****1001')

    await wrapper.get('.contacts-card__header .el-button').trigger('click')
    expect(document.body.textContent).toContain('添加联系人')
    wrapper.unmount()
  })
})
