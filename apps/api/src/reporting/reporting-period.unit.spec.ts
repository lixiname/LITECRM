import { describe, expect, it, vi } from 'vitest'
import { ReportingService } from './reporting.service'
import type { AuthUser } from '../auth/auth.service'
import type { AccessService } from '../access/access.service'

vi.mock('../common/db/db', () => ({ db: {} }))

function setup() {
  const service = new ReportingService({} as AccessService)
  const row = (
    id: string,
    stage: string,
    initialAmount: string | null,
    estimatedAmount: string | null = null,
  ) => ({
    id,
    stage,
    initialAmount,
    estimatedAmount,
    ownerId: 'owner',
    ownerName: '业务员',
    customerId: 'customer',
    customerName: '客户',
    createdAt: new Date('2026-08-12T02:00:00Z'),
    expectedCloseDate: null,
    closedAt: stage === 'lost' ? '2026-09-01' : null,
  })
  const context = {
    rows: [
      row('open', 'following', '100'),
      row('won', 'won', '200'),
      row('lost', 'lost', '300'),
      row('disappeared', 'demand_disappeared', '400'),
      row('legacy', 'intent', null, '50'),
      row('unknown', 'following', null),
      row('zero', 'intent', '0'),
    ],
    quotes: [],
    latestActiveQuote: new Map([
      ['open', { kind: 'formal', amount: '900', quotedAt: '2026-09-01' }],
      ['unknown', { kind: 'oral', amount: '700', quotedAt: '2026-09-01' }],
    ]),
    firstQuote: new Map(),
    firstFormalQuote: new Map(),
    latestFollowUp: new Map(),
    currentAction: new Map(),
    dealByOpportunity: new Map([['won', { amount: '250', occurredAt: '2026-09-02' }]]),
  }
  const internals = service as unknown as {
    scope: () => Promise<unknown>
    loadPipelineContext: () => Promise<unknown>
  }
  vi.spyOn(internals, 'scope').mockResolvedValue({
    targetIds: ['owner'],
    members: [
      {
        id: 'owner',
        displayName: '业务员',
        salesRegionId: null,
        salesRegionName: null,
        salesRegionSortOrder: null,
      },
    ],
  })
  vi.spyOn(internals, 'loadPipelineContext').mockResolvedValue(context)
  return { service, context }
}

describe('新增商机与当前池子分开统计', () => {
  const actor = { id: 'owner' } as AuthUser
  it('创建月份包含已成交/丢失/需求消失；新增金额不使用当前报价，缺失金额单独提示', async () => {
    const { service } = setup()
    const result = await service.pipeline({ start: '2026-08-01', end: '2026-08-31' }, actor)
    expect(result.flow.created).toEqual({ count: 7, amount: 1050, missingAmountCount: 1 })
    expect(result.pool.totalCount).toBe(4)
    expect(result.pool.totalAmount).toBe(1650)
    expect(result.flow.won.count).toBe(0)
  })
  it('切月份只改变期间统计，不改变当前池子；后续报价只改变池子', async () => {
    const { service, context } = setup()
    const august = await service.pipeline({ start: '2026-08-01', end: '2026-08-31' }, actor)
    const september = await service.pipeline({ start: '2026-09-01', end: '2026-09-30' }, actor)
    expect(september.flow.created.count).toBe(0)
    expect(september.flow.won).toEqual({ count: 1, amount: 250 })
    expect(september.pool).toEqual(august.pool)
    context.latestActiveQuote.get('open')!.amount = '1200'
    const afterQuote = await service.pipeline({ start: '2026-08-01', end: '2026-08-31' }, actor)
    expect(afterQuote.flow.created).toEqual(august.flow.created)
    expect(afterQuote.pool.totalAmount).toBe(1950)
  })
})
