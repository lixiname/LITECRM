import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import CockpitPipelinePanel from './CockpitPipelinePanel.vue'

describe('CockpitPipelinePanel', () => {
  it('中央圆环呈现正式报价在当前有效商机池的金额占比，而非目标达成率', () => {
    const wrapper = mount(CockpitPipelinePanel, {
      props: {
        pool: {
          asOf: '2026-10-05',
          totalCount: 10,
          totalAmount: 1_000_000,
          buckets: [
            { key: 'estimate', label: '仅预估', count: 3, amount: 200_000 },
            { key: 'oral_quote', label: '口头报价', count: 4, amount: 300_000 },
            { key: 'formal_quote', label: '正式报价', count: 3, amount: 500_000 },
          ],
          health: {
            stagnantCount: 2,
            stagnantAmount: 260_000,
            overdueActionCount: 1,
            noNextActionCount: 1,
          },
        },
      },
    })

    const ring = wrapper.find('.cockpit-pipeline__ring')
    expect(ring.attributes('aria-label')).toBe('正式报价金额占有效商机池 50%')
    expect(ring.attributes('style')).toContain('--formal-share: 50%')
    expect(wrapper.text()).toContain('¥1,000,000')
    expect(wrapper.text()).toContain('¥20.0万')
    expect(wrapper.text()).toContain('¥30.0万')
    expect(wrapper.text()).not.toContain('目标达成')
  })
})
