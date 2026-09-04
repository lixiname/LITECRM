import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getReportingOverview, getTeamReport, type ReportingOverview } from '@crm/domain'
import ManagementDashboardPage from './ManagementDashboardPage.vue'
import ReportingPeriodSelector from '../components/reporting/ReportingPeriodSelector.vue'

vi.mock('@crm/domain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@crm/domain')>()),
  listReportingMembers: vi.fn().mockResolvedValue([]),
  listSalesRegions: vi.fn().mockResolvedValue([]),
  listDimensionOptions: vi.fn().mockResolvedValue([]),
  getReportingOverview: vi.fn(),
  getPipelineReport: vi.fn(),
  getKeyCustomerReport: vi.fn(),
  getExpenseReport: vi.fn(),
  getTeamReport: vi.fn().mockResolvedValue({ members: [] }),
}))

function overview(amount = 100): ReportingOverview {
  return {
    range: { start: '2026-09-01', end: '2026-09-30' },
    pipeline: {
      pool: {
        asOf: '2026-09-04',
        totalCount: 5,
        totalAmount: 1000,
        buckets: [],
        health: {
          stagnantCount: 0,
          stagnantAmount: 0,
          overdueActionCount: 0,
          noNextActionCount: 0,
        },
      },
      created: { count: 2, amount, missingAmountCount: 0 },
      wonAmount: 50,
      closedWinRate: 0.5,
    },
    team: { actualRecordCount: 0, pendingCount: 0, overdueCount: 0 },
    keyCustomers: { totalCount: 0, attentionCount: 0, topAttention: [] },
    expenses: { submittedAmount: 0, draftDays: 0 },
  }
}

function mountDashboard() {
  return mount(ManagementDashboardPage, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        PipelineCompositionCard: {
          props: ['pool'],
          template: '<div data-test="pool">{{ pool.totalAmount }}</div>',
        },
        ReportingOverviewPanel: {
          props: ['data'],
          template: '<div data-test="period-data">{{ data.pipeline.created.amount }}</div>',
        },
        TeamReportPanel: { template: '<div>独立天周视图</div>' },
      },
    },
  })
}

describe('经营看板期间选择', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-04T04:00:00Z'))
    vi.clearAllMocks()
    vi.mocked(getReportingOverview).mockResolvedValue(overview())
  })
  afterEach(() => vi.useRealTimers())

  it('默认月份、周/月互斥，池子在周期控件之上，移除任意日期范围', async () => {
    const wrapper = mountDashboard()
    try {
      await flushPromises()
      expect(getReportingOverview).toHaveBeenLastCalledWith(
        expect.objectContaining({ start: '2026-09-01', end: '2026-09-30' }),
      )
      const selector = wrapper.getComponent(ReportingPeriodSelector)
      expect(selector.getComponent({ name: 'ElSelect' }).props('modelValue')).toBe('2026-09')
      expect(
        selector.findAllComponents({ name: 'ElOption' }).map((option) => option.props('value')),
      ).toEqual(['2027-02', '2027-01', '2026-12', '2026-11', '2026-10', '2026-09'])
      expect(selector.text()).not.toContain('显示更早年份')
      expect(wrapper.find('.el-date-editor').exists()).toBe(false)
      expect(
        wrapper
          .get('[data-test="pool"]')
          .element.compareDocumentPosition(wrapper.get('.management-dashboard__period').element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      await selector
        .findAll('button')
        .find((button) => button.text() === '上周')!
        .trigger('click')
      await flushPromises()
      expect(getReportingOverview).toHaveBeenLastCalledWith(
        expect.objectContaining({ start: '2026-08-24', end: '2026-08-30' }),
      )
      expect(selector.getComponent({ name: 'ElSelect' }).props('modelValue')).toBeUndefined()
      expect(
        selector
          .findAll('button')
          .find((button) => button.text() === '上周')!
          .attributes('aria-pressed'),
      ).toBe('true')
      selector.getComponent({ name: 'ElSelect' }).vm.$emit('change', '2027-02')
      await flushPromises()
      expect(getReportingOverview).toHaveBeenLastCalledWith(
        expect.objectContaining({ start: '2027-02-01', end: '2027-02-28' }),
      )
      expect(
        selector
          .findAll('button')
          .find((button) => button.text() === '上周')!
          .attributes('aria-pressed'),
      ).toBe('false')
    } finally {
      wrapper.unmount()
    }
  })

  it('连续切换月份时旧响应不能覆盖最新选择', async () => {
    const wrapper = mountDashboard()
    try {
      await flushPromises()
      let resolveOlder!: (data: ReportingOverview) => void
      let resolveNewer!: (data: ReportingOverview) => void
      vi.mocked(getReportingOverview)
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveOlder = resolve
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveNewer = resolve
            }),
        )
      const selector = wrapper.getComponent(ReportingPeriodSelector)
      selector.vm.$emit('update:modelValue', { kind: 'month', month: '2026-10' })
      selector.vm.$emit('update:modelValue', { kind: 'month', month: '2026-11' })
      resolveNewer(overview(700))
      await flushPromises()
      resolveOlder(overview(800))
      await flushPromises()
      expect(wrapper.get('[data-test="period-data"]').text()).toBe('700')
      expect(wrapper.get('[data-test="pool"]').text()).toBe('1000')
    } finally {
      wrapper.unmount()
    }
  })

  it('团队动态隐藏月度周期，继续请求自己的当日范围', async () => {
    const wrapper = mountDashboard()
    try {
      await flushPromises()
      await wrapper
        .findAll('[role="tab"]')
        .find((tab) => tab.text() === '团队动态')!
        .trigger('click')
      await flushPromises()
      expect(wrapper.findComponent(ReportingPeriodSelector).exists()).toBe(false)
      expect(getTeamReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ start: '2026-09-04', end: '2026-09-04' }),
      )
    } finally {
      wrapper.unmount()
    }
  })
})
