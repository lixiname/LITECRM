import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createRouter, createMemoryHistory } from 'vue-router'
import { describe, expect, it } from 'vitest'
import type { CustomerOpportunitySummary } from '@crm/domain'
import CustomerOpportunityProgress from './CustomerOpportunityProgress.vue'

describe('客户商机进展阅读与导航', () => {
  it('开放商机优先，键盘可进入所属商机，缺少计划与结案结果分开呈现', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/customers/customer-1')
    const opportunities = [
      {
        id: 'won-1',
        name: '已成交设备',
        stage: 'won',
        referenceAmount: '100000',
        amountBasis: 'formal_quote',
        activity: [],
        currentAction: null,
        riskFlags: [],
      },
      {
        id: 'open-1',
        name: '待推进的过滤设备',
        stage: 'following',
        referenceAmount: '200000',
        amountBasis: 'estimate',
        activity: [],
        currentAction: null,
        riskFlags: ['no_pending_action'],
      },
    ] as unknown as CustomerOpportunitySummary[]
    const wrapper = mount(CustomerOpportunityProgress, {
      props: { opportunities },
      global: { plugins: [ElementPlus, router] },
    })
    try {
      const cards = wrapper.findAll('[role="link"]')
      expect(cards[0]!.text()).toContain('待推进的过滤设备')
      expect(cards[0]!.text()).toContain('缺少下一步计划')
      expect(cards[1]!.text()).toContain('结案结果')
      expect(cards[1]!.text()).not.toContain('缺少下一步计划')
      await cards[0]!.trigger('keydown.enter')
      await flushPromises()
      expect(router.currentRoute.value.path).toBe('/opportunities/open-1')
    } finally {
      wrapper.unmount()
    }
  })
})
