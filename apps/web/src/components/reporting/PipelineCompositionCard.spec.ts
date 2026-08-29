import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PipelineCompositionCard from './PipelineCompositionCard.vue'

describe('PipelineCompositionCard', () => {
  it('把开放商机总额、互斥构成和交叉风险表达为不同层级', () => {
    const wrapper = mount(PipelineCompositionCard, {
      props: {
        pool: {
          asOf: '2026-08-29',
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

    expect(wrapper.text()).toContain('¥1,000,000')
    expect(wrapper.text()).toContain('仅预估')
    expect(wrapper.text()).toContain('20%')
    expect(wrapper.text()).toContain('口头报价')
    expect(wrapper.text()).toContain('30%')
    expect(wrapper.text()).toContain('正式报价')
    expect(wrapper.text()).toContain('50%')
    expect(wrapper.text()).toContain('其中停滞')
    expect(wrapper.text()).toContain('行动逾期 1 个')
    expect(wrapper.findAll('.pipeline-composition__bar span')).toHaveLength(3)
  })
})
