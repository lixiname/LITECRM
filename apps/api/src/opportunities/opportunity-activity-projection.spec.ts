import { describe, expect, it } from 'vitest'
import { buildOpportunityActivity } from './opportunity-activity-projection'

const opportunity = {
  id: 'opportunity-1',
  name: '过滤系统改造',
  stage: 'following',
  discoveredDate: '2026-08-01',
  closedAt: null,
  closeReason: null,
  createdAt: '2026-08-01T01:00:00Z',
  updatedAt: '2026-08-10T01:00:00Z',
}

describe('opportunity activity projection', () => {
  it('按真实事实生成动态节点且不混入下一计划', () => {
    const activity = buildOpportunityActivity(
      opportunity,
      [
        {
          id: 'follow-up-1',
          occurredAt: '2026-08-10',
          conclusion: '客户确认流量参数',
          method: 'phone',
          createdAt: '2026-08-10T02:00:00Z',
        },
      ],
      [
        {
          id: 'quote-1',
          quotedAt: '2026-08-10',
          kind: 'formal',
          amount: '365000',
          quoteNo: 'Q-001',
          status: 'active',
          note: null,
          createdAt: '2026-08-10T03:00:00Z',
        },
      ],
    )

    expect(activity.map((item) => item.type)).toEqual(['quote', 'follow_up', 'discovered'])
    expect(activity[0]?.summary).toContain('365,000')
    expect(activity.map((item) => item.type)).not.toContain('next_action')
  })

  it('未成交终态形成明确结案节点', () => {
    const activity = buildOpportunityActivity(
      {
        ...opportunity,
        stage: 'lost',
        closedAt: '2026-08-20',
        closeReason: '被友商抢走',
        updatedAt: '2026-08-20T05:00:00Z',
      },
      [],
      [],
    )

    expect(activity[0]).toMatchObject({
      type: 'lost',
      occurredAt: '2026-08-20',
      summary: '被友商抢走',
    })
  })
})
