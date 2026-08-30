import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import CustomerContactsCard from './CustomerContactsCard.vue'
import { maskPhone } from './customer-presentation'

vi.mock('@crm/domain', () => ({
  addContact: vi.fn(),
  updateContact: vi.fn(),
  removeContact: vi.fn(),
  listDimensionOptions: vi.fn().mockResolvedValue([
    {
      id: 'function-1',
      dimension: 'contact_function',
      name: 'equipment_engineering',
      label: '设备／工程',
      sortOrder: 0,
      isActive: true,
    },
  ]),
  useQuery: vi.fn(() => ({
    data: {
      value: [
        {
          id: 'function-1',
          dimension: 'contact_function',
          name: 'equipment_engineering',
          label: '设备／工程',
          sortOrder: 0,
          isActive: true,
        },
      ],
    },
  })),
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
            functionRole: 'equipment_engineering',
            phone: '13800001001',
            isKeyContact: true,
            version: 1,
          },
        ],
      },
      global: { plugins: [ElementPlus] },
    })

    expect(wrapper.findAll('.contacts-card__item')).toHaveLength(1)
    expect(wrapper.text()).toContain('张工')
    expect(wrapper.text()).toContain('设备／工程')
    expect(wrapper.text()).toContain('138****1001')
    expect(maskPhone('13800001001')).toBe('138****1001')

    await wrapper.get('.contacts-card__header .el-button').trigger('click')
    expect(document.body.textContent).toContain('添加联系人')
    wrapper.unmount()
  })
})
