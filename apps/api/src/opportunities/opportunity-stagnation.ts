import { sql, type SQL } from 'drizzle-orm'
import { followUpActions, opportunities, opportunityQuotes } from '../common/db/schema'

const OPEN_STAGES = ['intent', 'following'] as const
export const OPPORTUNITY_INACTIVITY_DAYS = 30

/** 列表筛选与行内标记共用的停滞 SQL 口径。 */
export function opportunityStagnationSql(): SQL {
  return sql`(
    ${opportunities.stage} in ('intent', 'following') and (
      not exists (
        select 1 from ${followUpActions}
        where ${followUpActions.opportunityId} = ${opportunities.id}
          and ${followUpActions.status} = 'pending'
      )
      or exists (
        select 1 from ${followUpActions}
        where ${followUpActions.opportunityId} = ${opportunities.id}
          and ${followUpActions.status} = 'pending'
          and ${followUpActions.plannedAt} < now()
      )
      or greatest(
        ${opportunities.createdAt},
        coalesce(${opportunities.lastFollowUpAt}, ${opportunities.createdAt}),
        coalesce((
          select max(${opportunityQuotes.quotedAt})
          from ${opportunityQuotes}
          where ${opportunityQuotes.opportunityId} = ${opportunities.id}
        ), ${opportunities.createdAt})
      ) < now() - interval '${sql.raw(String(OPPORTUNITY_INACTIVITY_DAYS))} days'
      or (${opportunities.expectedCloseDate} is not null and ${opportunities.expectedCloseDate} < current_date)
    )
  )`
}

type OpportunityContext = {
  stage: string
  createdAt: Date | string
  expectedCloseDate: string | null
}

type ActionContext = { plannedAt: Date | string } | null
type QuoteContext = { quotedAt: Date | string } | null
type FollowUpContext = { occurredAt: Date | string } | null

/** 将事实投影为工作台风险；不写回数据库。 */
export function deriveOpportunityStagnation(
  opportunity: OpportunityContext,
  currentAction: ActionContext,
  latestQuote: QuoteContext,
  latestFollowUp: FollowUpContext,
) {
  const activityTimes = [
    new Date(opportunity.createdAt).getTime(),
    latestQuote ? new Date(latestQuote.quotedAt).getTime() : 0,
    latestFollowUp ? new Date(latestFollowUp.occurredAt).getTime() : 0,
  ]
  const lastBusinessActivityAt = new Date(Math.max(...activityTimes))
  const inactiveDays = Math.max(
    0,
    Math.floor((Date.now() - lastBusinessActivityAt.getTime()) / 86_400_000),
  )
  const riskFlags: string[] = []
  if ((OPEN_STAGES as readonly string[]).includes(opportunity.stage)) {
    if (!currentAction) riskFlags.push('no_pending_action')
    if (currentAction && new Date(currentAction.plannedAt).getTime() < Date.now()) {
      riskFlags.push('action_overdue')
    }
    if (inactiveDays >= OPPORTUNITY_INACTIVITY_DAYS) riskFlags.push('inactive_30d')
    if (
      opportunity.expectedCloseDate &&
      new Date(`${opportunity.expectedCloseDate}T23:59:59`).getTime() < Date.now()
    ) {
      riskFlags.push('expected_close_overdue')
    }
  }
  return { lastBusinessActivityAt, inactiveDays, riskFlags }
}
