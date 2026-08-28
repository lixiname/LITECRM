import { describe, expect, it } from 'vitest'
import type { ActionWeekView, SalesPlan } from '@crm/domain'
import { buildMobileWeekDays, salesPlanExecutionRoute } from '../sales-workbench'

const plan: SalesPlan = {
  id: 'plan-1',
  ownerId: 'owner-1',
  customerId: 'customer-1',
  opportunityId: null,
  complaintId: null,
  planKind: 'customer_visit',
  originType: 'manual',
  sourceId: null,
  plannedAt: '2026-08-24T09:00:00+08:00',
  content: '拜访客户',
  status: 'completed',
  completedAt: '2026-08-24T10:00:00+08:00',
  cancelReason: null,
  version: 2,
  createdAt: '2026-08-20T00:00:00+08:00',
  updatedAt: '2026-08-24T10:00:00+08:00',
}

describe('mobile sales workbench projection', () => {
  it('keeps a completed plan and its actual record in the original day', () => {
    const view: ActionWeekView = {
      ownerId: 'owner-1',
      overdue: [],
      plans: [plan],
      businessRecords: [
        {
          id: 'visit-1',
          type: 'customer_visit',
          occurredAt: '2026-08-24T10:00:00+08:00',
          customerId: 'customer-1',
          customerName: '测试客户',
          opportunityId: null,
          opportunityName: null,
          summary: '已完成拜访',
          sourcePlanId: plan.id,
        },
      ],
      complaintRecords: [],
    }

    const monday = buildMobileWeekDays('2026-08-24', '2026-08-24', view)[0]
    expect(monday.pendingPlans).toHaveLength(0)
    expect(monday.closedPlans).toHaveLength(1)
    expect(monday.actualRecords).toHaveLength(1)
    expect(monday.actualRecords[0]?.sourcePlanId).toBe(plan.id)
  })

  it('routes each plan kind to its domain execution page', () => {
    expect(salesPlanExecutionRoute(plan)).toContain('/visit/new?planId=plan-1')
    expect(
      salesPlanExecutionRoute({
        ...plan,
        planKind: 'opportunity_follow_up',
        opportunityId: 'opportunity-1',
      }),
    ).toBe('/opportunities/opportunity-1/follow-up?planId=plan-1')
  })
})
