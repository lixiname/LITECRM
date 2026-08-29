import { businessDate } from '../common/business-date'

export type OpportunityActivityType =
  'discovered' | 'follow_up' | 'quote' | 'won' | 'lost' | 'demand_disappeared'

export interface OpportunityActivityItem {
  id: string
  type: OpportunityActivityType
  occurredAt: string
  title: string
  summary: string
  metadata?: Record<string, string | null>
}

type OpportunityFact = {
  id: string
  name: string
  stage: string
  discoveredDate: string | null
  closedAt: string | null
  closeReason: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

type FollowUpFact = {
  id: string
  occurredAt: string
  conclusion: string
  method: string | null
  createdAt: Date | string
}

type QuoteFact = {
  id: string
  quotedAt: string
  kind: string
  amount: string
  quoteNo: string | null
  status: string
  note: string | null
  createdAt: Date | string
}

type DealFact = {
  id: string
  occurredAt: string
  amount: string
  createdAt: Date | string
}

/**
 * 商机活动由不可变业务事实投影，不把下一计划混入已发生历史。
 * 返回顺序为最新在前；同一业务日期按系统写入时间稳定排序。
 */
export function buildOpportunityActivity(
  opportunity: OpportunityFact,
  followUps: FollowUpFact[],
  quotes: QuoteFact[],
  deal?: DealFact | null,
): OpportunityActivityItem[] {
  const items: (OpportunityActivityItem & { sortAt: Date | string })[] = [
    {
      id: opportunity.id,
      type: 'discovered',
      occurredAt: opportunity.discoveredDate ?? businessDate(opportunity.createdAt),
      title: '发现需求',
      summary: opportunity.name,
      sortAt: opportunity.createdAt,
    },
    ...followUps.map((followUp) => ({
      id: followUp.id,
      type: 'follow_up' as const,
      occurredAt: followUp.occurredAt,
      title: '商机跟进',
      summary: followUp.conclusion,
      metadata: { method: followUp.method },
      sortAt: followUp.createdAt,
    })),
    ...quotes.map((quote) => ({
      id: quote.id,
      type: 'quote' as const,
      occurredAt: quote.quotedAt,
      title: quote.kind === 'formal' ? '正式报价' : '口头报价',
      summary: `¥${Number(quote.amount).toLocaleString('zh-CN')}${quote.note ? ` · ${quote.note}` : ''}`,
      metadata: {
        kind: quote.kind,
        status: quote.status,
        quoteNo: quote.quoteNo,
        amount: quote.amount,
      },
      sortAt: quote.createdAt,
    })),
  ]

  if (deal) {
    items.push({
      id: deal.id,
      type: 'won',
      occurredAt: deal.occurredAt,
      title: '确认成交',
      summary: `成交金额 ¥${Number(deal.amount).toLocaleString('zh-CN')}`,
      metadata: { amount: deal.amount },
      sortAt: deal.createdAt,
    })
  } else if (
    (opportunity.stage === 'lost' || opportunity.stage === 'demand_disappeared') &&
    opportunity.closedAt
  ) {
    const type = opportunity.stage as 'lost' | 'demand_disappeared'
    items.push({
      id: `${opportunity.id}:${type}`,
      type,
      occurredAt: opportunity.closedAt,
      title: type === 'lost' ? '商机丢失' : '需求消失',
      summary: opportunity.closeReason ?? (type === 'lost' ? '未成交结案' : '客户需求消失'),
      sortAt: opportunity.updatedAt,
    })
  }

  return items
    .sort((a, b) => {
      const byDate = b.occurredAt.localeCompare(a.occurredAt)
      if (byDate !== 0) return byDate
      return new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
    })
    .map(({ sortAt: _, ...item }) => item)
}
