import { Injectable } from '@nestjs/common'
import { and, eq, inArray, sql, type AnyColumn } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { db } from '../common/db/db'
import {
  complaintFollowUps,
  complaints,
  customers,
  opportunities,
  opportunityFollowUps,
  opportunityQuotes,
  visitRecords,
} from '../common/db/schema'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'

@Injectable()
export class WeekViewService {
  constructor(
    private readonly plansService: SalesPlansService,
    private readonly accessService: AccessService,
  ) {}

  async getWeekView(user: AuthUser, start: string, end: string) {
    const visible = await this.accessService.getVisibleUserIds(user)
    const inRange = (column: AnyColumn) => sql`${column}::date between ${start} and ${end}`

    const [planView, visits, followUps, quotes, registeredComplaints, complaintUpdates] =
      await Promise.all([
        this.plansService.week(user, start, end),
        db
          .select({
            id: visitRecords.id,
            occurredAt: visitRecords.occurredAt,
            customerId: visitRecords.customerId,
            customerName: customers.name,
            businessSituation: visitRecords.businessSituation,
            sourcePlanId: visitRecords.sourcePlanId,
          })
          .from(visitRecords)
          .innerJoin(customers, eq(visitRecords.customerId, customers.id))
          .where(and(inArray(customers.ownerId, visible), inRange(visitRecords.occurredAt))),
        db
          .select({
            id: opportunityFollowUps.id,
            occurredAt: opportunityFollowUps.occurredAt,
            customerId: opportunities.customerId,
            customerName: customers.name,
            opportunityId: opportunities.id,
            opportunityName: opportunities.name,
            conclusion: opportunityFollowUps.conclusion,
            sourcePlanId: opportunityFollowUps.sourcePlanId,
          })
          .from(opportunityFollowUps)
          .innerJoin(opportunities, eq(opportunityFollowUps.opportunityId, opportunities.id))
          .innerJoin(customers, eq(opportunities.customerId, customers.id))
          .where(
            and(inArray(customers.ownerId, visible), inRange(opportunityFollowUps.occurredAt)),
          ),
        db
          .select({
            id: opportunityQuotes.id,
            occurredAt: opportunityQuotes.quotedAt,
            customerId: opportunities.customerId,
            customerName: customers.name,
            opportunityId: opportunities.id,
            opportunityName: opportunities.name,
            amount: opportunityQuotes.amount,
            kind: opportunityQuotes.kind,
            sourcePlanId: opportunityQuotes.sourcePlanId,
          })
          .from(opportunityQuotes)
          .innerJoin(opportunities, eq(opportunityQuotes.opportunityId, opportunities.id))
          .innerJoin(customers, eq(opportunities.customerId, customers.id))
          .where(and(inArray(customers.ownerId, visible), inRange(opportunityQuotes.quotedAt))),
        db
          .select({
            id: complaints.id,
            occurredAt: complaints.occurredAt,
            customerId: complaints.customerId,
            customerName: customers.name,
            description: complaints.description,
          })
          .from(complaints)
          .innerJoin(customers, eq(complaints.customerId, customers.id))
          .where(and(inArray(customers.ownerId, visible), inRange(complaints.occurredAt))),
        db
          .select({
            id: complaintFollowUps.id,
            occurredAt: complaintFollowUps.occurredAt,
            customerId: complaints.customerId,
            customerName: customers.name,
            complaintId: complaints.id,
            content: complaintFollowUps.content,
            sourcePlanId: complaintFollowUps.sourcePlanId,
          })
          .from(complaintFollowUps)
          .innerJoin(complaints, eq(complaintFollowUps.complaintId, complaints.id))
          .innerJoin(customers, eq(complaints.customerId, customers.id))
          .where(and(inArray(customers.ownerId, visible), inRange(complaintFollowUps.occurredAt))),
      ])

    return {
      ...planView,
      businessRecords: [
        ...visits.map((item) => ({
          id: item.id,
          type: 'customer_visit' as const,
          occurredAt: item.occurredAt,
          customerId: item.customerId,
          customerName: item.customerName,
          opportunityId: null,
          opportunityName: null,
          summary: item.businessSituation || '已登记客户拜访',
          sourcePlanId: item.sourcePlanId,
        })),
        ...followUps.map((item) => ({
          id: item.id,
          type: 'opportunity_follow_up' as const,
          occurredAt: item.occurredAt,
          customerId: item.customerId,
          customerName: item.customerName,
          opportunityId: item.opportunityId,
          opportunityName: item.opportunityName,
          summary: item.conclusion,
          sourcePlanId: item.sourcePlanId,
        })),
        ...quotes.map((item) => ({
          id: item.id,
          type: 'opportunity_quote' as const,
          occurredAt: item.occurredAt,
          customerId: item.customerId,
          customerName: item.customerName,
          opportunityId: item.opportunityId,
          opportunityName: item.opportunityName,
          summary: `${item.kind === 'formal' ? '正式' : '口头'}报价 ¥${Number(item.amount).toLocaleString('zh-CN')}`,
          sourcePlanId: item.sourcePlanId,
        })),
      ],
      complaintRecords: [
        ...registeredComplaints.map((item) => ({
          id: item.id,
          type: 'complaint_registered' as const,
          occurredAt: item.occurredAt,
          customerId: item.customerId,
          customerName: item.customerName,
          complaintId: item.id,
          summary: item.description,
          sourcePlanId: null,
        })),
        ...complaintUpdates.map((item) => ({
          id: item.id,
          type: 'complaint_follow_up' as const,
          occurredAt: item.occurredAt,
          customerId: item.customerId,
          customerName: item.customerName,
          complaintId: item.complaintId,
          summary: item.content,
          sourcePlanId: item.sourcePlanId,
        })),
      ],
    }
  }
}
