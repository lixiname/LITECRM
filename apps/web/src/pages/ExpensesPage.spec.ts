import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { describe, expect, it, vi } from 'vitest'
import { listExpenses, localBusinessDate, shiftExpenseMonth, type Expense } from '@crm/domain'
import ExpensesPage from './ExpensesPage.vue'

const baseExpense: Expense = {
  id: '',
  ownerId: 'owner',
  expenseDate: '',
  tobaccoAlcohol: null,
  gifts: null,
  dining: null,
  entertainment: null,
  lodging: null,
  notes: null,
  status: 'draft',
  version: 1,
  createdAt: '',
  updatedAt: '',
}

vi.mock('@crm/domain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@crm/domain')>()),
  listExpenses: vi.fn(async (month: string) => {
    const current = localBusinessDate().slice(0, 7)
    if (month !== current) return []
    return [
      {
        ...baseExpense,
        id: 'submitted',
        expenseDate: `${month}-01`,
        dining: '100',
        status: 'submitted',
      },
      { ...baseExpense, id: 'draft', expenseDate: `${month}-02`, gifts: '40' },
      { ...baseExpense, id: 'voided', expenseDate: `${month}-03`, lodging: '80', status: 'voided' },
    ]
  }),
}))

describe('PC 个人费用月历', () => {
  it('按日期展示状态，月合计排除草稿与作废，支持切月', async () => {
    const wrapper = mount(ExpensesPage, { global: { plugins: [ElementPlus] } })
    try {
      await flushPromises()
      expect(wrapper.get('.expenses__summary').text()).toContain('¥100')
      expect(wrapper.get('.expenses__summary').text()).toContain('1 天')
      expect(wrapper.get('[aria-label*="-03，已作废"]')).toBeTruthy()
      await wrapper.get('[aria-label*="-02，草稿"]').trigger('click')
      expect(wrapper.get('.expenses__detail').text()).toContain('礼品 ¥40')
      expect(wrapper.get('.expenses__actions').text()).toContain('提交')
      await wrapper.get('[aria-label="上个月"]').trigger('click')
      await flushPromises()
      expect(listExpenses).toHaveBeenLastCalledWith(
        shiftExpenseMonth(localBusinessDate().slice(0, 7), -1),
      )
    } finally {
      wrapper.unmount()
    }
  })
})
