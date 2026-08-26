import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'
import CustomerActivityTimeline from './CustomerActivityTimeline.vue'

vi.mock('@crm/domain', () => ({
  listDimensionOptions: vi.fn().mockResolvedValue([]),
  OPPORTUNITY_STAGE_OPTIONS: [
    { value: 'intent', label: '意向' },
    { value: 'following', label: '跟进中' },
  ],
  VISIT_METHOD_OPTIONS: [{ value: 'offline_visit', label: '线下拜访' }],
}))

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<div />' } },
      { path: '/opportunities/:id', component: { template: '<div />' } },
      { path: '/complaints/:id', component: { template: '<div />' } },
    ],
  })
}

describe('CustomerActivityTimeline', () => {
  it('空时间线仍显示明确空态', () => {
    const wrapper = mount(CustomerActivityTimeline, {
      props: { items: [] },
      global: { plugins: [ElementPlus, createTestRouter()] },
    })
    expect(wrapper.text()).toContain('客户活动时间线')
    expect(wrapper.text()).toContain('还没有客户活动')
  })

  it('聚合展示商机活动并可回到来源对象', async () => {
    const router = createTestRouter()
    const push = vi.spyOn(router, 'push')
    await router.push('/')
    await router.isReady()
    const wrapper = mount(CustomerActivityTimeline, {
      props: {
        items: [
          {
            type: 'opportunity_follow_up',
            id: 'follow-up-1',
            occurredAt: '2026-08-26T08:00:00.000Z',
            title: '商机跟进',
            summary: '客户确认技术参数',
            targetType: 'opportunity',
            targetId: 'opportunity-1',
            metadata: { opportunityName: '过滤系统改造' },
          },
        ],
      },
      global: { plugins: [ElementPlus, router] },
    })

    expect(wrapper.text()).toContain('客户确认技术参数')
    expect(wrapper.text()).toContain('过滤系统改造')
    await wrapper.get('.activity-card__item--link').trigger('click')
    expect(push).toHaveBeenCalledWith('/opportunities/opportunity-1')
  })
})
