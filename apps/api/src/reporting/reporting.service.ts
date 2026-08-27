import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, inArray, or, sql, type AnyColumn, type SQL } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { db } from '../common/db/db'
import {
  complaintFollowUps,
  complaints,
  customers,
  dailyExpenses,
  deals,
  followUpActions,
  opportunities,
  opportunityFollowUps,
  opportunityProductLines,
  opportunityQuotes,
  salesRegions,
  users,
  visitRecords,
} from '../common/db/schema'
import { deriveOpportunityStagnation } from '../opportunities/opportunity-stagnation'
import type { ReportingQueryDto } from './dto/reporting-query.dto'

const OPEN_STAGES = new Set(['intent', 'following'])
const DAY_MS = 86_400_000

type Member = { id: string; displayName: string; role: string }
type Range = { start: string; end: string }

type PipelineOpportunity = {
  id: string
  customerId: string
  customerName: string
  ownerId: string
  ownerName: string
  stage: string
  createdAt: Date
  expectedCloseDate: string | null
  closedAt: Date | null
  estimatedAmount: string | null
}

type QuoteRow = {
  id: string
  opportunityId: string
  kind: string
  status: string
  amount: string
  quotedAt: Date
}

type PipelineContext = {
  rows: PipelineOpportunity[]
  quotes: QuoteRow[]
  latestActiveQuote: Map<string, QuoteRow>
  firstQuote: Map<string, QuoteRow>
  firstFormalQuote: Map<string, QuoteRow>
  latestFollowUp: Map<string, { opportunityId: string; occurredAt: Date }>
  currentAction: Map<string, { opportunityId: string | null; plannedAt: Date }>
  dealByOpportunity: Map<string, { sourceOpportunityId: string; amount: string; occurredAt: Date }>
}

@Injectable()
export class ReportingService {
  constructor(private readonly accessService: AccessService) {}

  async members(actor: AuthUser): Promise<Member[]> {
    const visible = await this.accessService.getVisibleUserIds(actor)
    return db
      .select({ id: users.id, displayName: users.displayName, role: users.role })
      .from(users)
      .where(and(inArray(users.id, visible), eq(users.isActive, true)))
      .orderBy(asc(users.displayName))
  }

  async overview(query: ReportingQueryDto, actor: AuthUser) {
    const [pipeline, team, keyCustomers, expenses] = await Promise.all([
      this.pipeline(query, actor),
      this.team(query, actor),
      this.keyCustomers(query, actor),
      this.expenses(query, actor),
    ])
    return {
      range: pipeline.range,
      pipeline: {
        openCount: pipeline.pool.totalCount,
        openAmount: pipeline.pool.totalAmount,
        formalQuoteAmount:
          pipeline.pool.buckets.find((item) => item.key === 'formal_quote')?.amount ?? 0,
        wonAmount: pipeline.flow.won.amount,
        stagnantAmount: pipeline.byOwner.reduce((sum, item) => sum + item.stagnantAmount, 0),
      },
      team: {
        actualRecordCount: team.members.reduce((sum, item) => sum + item.actualRecordCount, 0),
        pendingCount: team.members.reduce((sum, item) => sum + item.pendingCount, 0),
        overdueCount: team.members.reduce((sum, item) => sum + item.overdueCount, 0),
      },
      keyCustomers: {
        totalCount: keyCustomers.totalCount,
        attentionCount: keyCustomers.attentionCount,
        topAttention: keyCustomers.items.filter((item) => item.needsAttention).slice(0, 6),
      },
      expenses: {
        submittedAmount: expenses.total.amount,
        draftDays: expenses.total.draftDays,
      },
    }
  }

  async pipeline(query: ReportingQueryDto, actor: AuthUser) {
    const range = this.range(query)
    const scope = await this.scope(query, actor)
    const context = await this.loadPipelineContext(query, scope.targetIds)
    const memberById = new Map(scope.members.map((member) => [member.id, member]))

    const poolBuckets = new Map(
      [
        ['estimate', '仅预估'],
        ['oral_quote', '口头报价'],
        ['formal_quote', '正式报价'],
      ].map(([key, label]) => [key, { key, label, count: 0, amount: 0 }]),
    )
    const byOwner = new Map(
      scope.members.map((member) => [
        member.id,
        {
          ownerId: member.id,
          ownerName: member.displayName,
          openCount: 0,
          openAmount: 0,
          estimateAmount: 0,
          oralQuoteAmount: 0,
          formalQuoteAmount: 0,
          stagnantCount: 0,
          stagnantAmount: 0,
          wonCount: 0,
          wonAmount: 0,
        },
      ]),
    )

    for (const opportunity of context.rows) {
      const owner = byOwner.get(opportunity.ownerId)
      if (!owner) continue
      const latestQuote = context.latestActiveQuote.get(opportunity.id) ?? null
      const referenceAmount = this.money(latestQuote?.amount ?? opportunity.estimatedAmount)
      if (OPEN_STAGES.has(opportunity.stage)) {
        const basis = latestQuote ? `${latestQuote.kind}_quote` : 'estimate'
        const bucket = poolBuckets.get(basis)
        if (bucket) {
          bucket.count += 1
          bucket.amount += referenceAmount
        }
        owner.openCount += 1
        owner.openAmount += referenceAmount
        if (basis === 'formal_quote') owner.formalQuoteAmount += referenceAmount
        else if (basis === 'oral_quote') owner.oralQuoteAmount += referenceAmount
        else owner.estimateAmount += referenceAmount

        const risk = deriveOpportunityStagnation(
          opportunity,
          context.currentAction.get(opportunity.id) ?? null,
          latestQuote,
          context.latestFollowUp.get(opportunity.id) ?? null,
        )
        if (risk.riskFlags.length > 0) {
          owner.stagnantCount += 1
          owner.stagnantAmount += referenceAmount
        }
      }

      const deal = context.dealByOpportunity.get(opportunity.id)
      if (deal && this.inRange(deal.occurredAt, range)) {
        owner.wonCount += 1
        owner.wonAmount += this.money(deal.amount)
      }
    }

    const flow = {
      created: { count: 0, amount: 0 },
      firstQuoted: { count: 0, amount: 0 },
      firstFormalQuoted: { count: 0, amount: 0 },
      won: { count: 0, amount: 0 },
      lost: { count: 0, amount: 0 },
      closedWinRate: null as number | null,
    }
    for (const opportunity of context.rows) {
      const latestQuote = context.latestActiveQuote.get(opportunity.id)
      const referenceAmount = this.money(latestQuote?.amount ?? opportunity.estimatedAmount)
      if (this.inRange(opportunity.createdAt, range)) {
        flow.created.count += 1
        flow.created.amount += referenceAmount
      }
      const firstQuote = context.firstQuote.get(opportunity.id)
      if (firstQuote && this.inRange(firstQuote.quotedAt, range)) {
        flow.firstQuoted.count += 1
        flow.firstQuoted.amount += this.money(firstQuote.amount)
      }
      const firstFormal = context.firstFormalQuote.get(opportunity.id)
      if (firstFormal && this.inRange(firstFormal.quotedAt, range)) {
        flow.firstFormalQuoted.count += 1
        flow.firstFormalQuoted.amount += this.money(firstFormal.amount)
      }
      const deal = context.dealByOpportunity.get(opportunity.id)
      if (deal && this.inRange(deal.occurredAt, range)) {
        flow.won.count += 1
        flow.won.amount += this.money(deal.amount)
      } else if (
        (opportunity.stage === 'lost' || opportunity.stage === 'demand_disappeared') &&
        opportunity.closedAt &&
        this.inRange(opportunity.closedAt, range)
      ) {
        flow.lost.count += 1
        flow.lost.amount += referenceAmount
      }
    }
    const closedCount = flow.won.count + flow.lost.count
    flow.closedWinRate = closedCount ? flow.won.count / closedCount : null

    const buckets = [...poolBuckets.values()]
    return {
      range,
      pool: {
        totalCount: buckets.reduce((sum, item) => sum + item.count, 0),
        totalAmount: buckets.reduce((sum, item) => sum + item.amount, 0),
        buckets,
      },
      flow,
      byOwner: [...byOwner.values()]
        .filter((item) => memberById.has(item.ownerId))
        .sort((a, b) => b.openAmount - a.openAmount || a.ownerName.localeCompare(b.ownerName)),
    }
  }

  async team(query: ReportingQueryDto, actor: AuthUser) {
    const range = this.range(query)
    const scope = await this.scope(query, actor)
    const timeCondition = (column: AnyColumn) =>
      sql`(${column} at time zone 'Asia/Shanghai')::date between ${range.start} and ${range.end}`
    const ids = scope.targetIds
    const [visits, followUps, quotes, registeredComplaints, complaintUpdates, actions] =
      await Promise.all([
        db
          .select({ ownerId: visitRecords.ownerId })
          .from(visitRecords)
          .where(and(inArray(visitRecords.ownerId, ids), timeCondition(visitRecords.occurredAt))),
        db
          .select({ ownerId: opportunityFollowUps.actorId })
          .from(opportunityFollowUps)
          .where(
            and(
              inArray(opportunityFollowUps.actorId, ids),
              timeCondition(opportunityFollowUps.occurredAt),
            ),
          ),
        db
          .select({ ownerId: opportunityQuotes.actorId, amount: opportunityQuotes.amount })
          .from(opportunityQuotes)
          .where(
            and(inArray(opportunityQuotes.actorId, ids), timeCondition(opportunityQuotes.quotedAt)),
          ),
        db
          .select({ ownerId: complaints.ownerId })
          .from(complaints)
          .where(and(inArray(complaints.ownerId, ids), timeCondition(complaints.occurredAt))),
        db
          .select({ ownerId: complaintFollowUps.ownerId })
          .from(complaintFollowUps)
          .where(
            and(
              inArray(complaintFollowUps.ownerId, ids),
              timeCondition(complaintFollowUps.occurredAt),
            ),
          ),
        db
          .select({
            id: followUpActions.id,
            ownerId: followUpActions.ownerId,
            status: followUpActions.status,
            plannedAt: followUpActions.plannedAt,
            content: followUpActions.content,
            customerId: followUpActions.customerId,
            customerName: customers.name,
          })
          .from(followUpActions)
          .innerJoin(customers, eq(followUpActions.customerId, customers.id))
          .where(
            and(
              inArray(followUpActions.ownerId, ids),
              or(
                timeCondition(followUpActions.plannedAt),
                and(
                  eq(followUpActions.status, 'pending'),
                  sql`${followUpActions.plannedAt} < now()`,
                ),
              ),
            ),
          ),
      ])

    const result = new Map(
      scope.members.map((member) => [
        member.id,
        {
          ownerId: member.id,
          ownerName: member.displayName,
          visits: 0,
          opportunityFollowUps: 0,
          quotes: 0,
          quoteAmount: 0,
          complaintRecords: 0,
          actualRecordCount: 0,
          pendingCount: 0,
          overdueCount: 0,
          completedPlanCount: 0,
          topOverdue: [] as {
            id: string
            customerId: string | null
            customerName: string
            content: string
            plannedAt: Date
          }[],
        },
      ]),
    )
    for (const row of visits) result.get(row.ownerId)!.visits += 1
    for (const row of followUps) result.get(row.ownerId)!.opportunityFollowUps += 1
    for (const row of quotes) {
      const item = result.get(row.ownerId)!
      item.quotes += 1
      item.quoteAmount += this.money(row.amount)
    }
    for (const row of [...registeredComplaints, ...complaintUpdates]) {
      result.get(row.ownerId)!.complaintRecords += 1
    }
    for (const item of result.values()) {
      item.actualRecordCount =
        item.visits + item.opportunityFollowUps + item.quotes + item.complaintRecords
    }
    const now = Date.now()
    for (const action of actions) {
      const item = result.get(action.ownerId)!
      const plannedInRange = this.inRange(action.plannedAt, range)
      if (action.status === 'pending' && plannedInRange) item.pendingCount += 1
      if (action.status === 'completed' && plannedInRange) item.completedPlanCount += 1
      if (action.status === 'pending' && action.plannedAt.getTime() < now) {
        item.overdueCount += 1
        item.topOverdue.push({
          id: action.id,
          customerId: action.customerId,
          customerName: action.customerName,
          content: action.content,
          plannedAt: action.plannedAt,
        })
      }
    }
    for (const item of result.values()) {
      item.topOverdue.sort((a, b) => a.plannedAt.getTime() - b.plannedAt.getTime())
      item.topOverdue = item.topOverdue.slice(0, 3)
    }
    return { range, members: [...result.values()] }
  }

  async keyCustomers(query: ReportingQueryDto, actor: AuthUser) {
    const range = this.range(query)
    const scope = await this.scope(query, actor)
    const conditions: SQL[] = [
      inArray(customers.ownerId, scope.targetIds),
      eq(customers.status, 'active'),
      inArray(customers.grade, ['S', 'A']),
    ]
    if (query.salesRegionId) conditions.push(eq(customers.salesRegionId, query.salesRegionId))
    if (query.productLine) {
      conditions.push(sql`exists (
        select 1 from ${opportunities}
        inner join ${opportunityProductLines}
          on ${opportunityProductLines.opportunityId} = ${opportunities.id}
        where ${opportunities.customerId} = ${customers.id}
          and ${opportunities.stage} in ('intent','following')
          and ${opportunityProductLines.productLine} = ${query.productLine}
      )`)
    }
    const customerRows = await db
      .select({
        id: customers.id,
        name: customers.name,
        grade: customers.grade,
        ownerId: customers.ownerId,
        ownerName: users.displayName,
        salesRegionName: salesRegions.name,
        lastActivityAt: customers.lastActivityAt,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .innerJoin(users, eq(customers.ownerId, users.id))
      .leftJoin(salesRegions, eq(customers.salesRegionId, salesRegions.id))
      .where(and(...conditions))

    const customerIds = customerRows.map((item) => item.id)
    if (customerIds.length === 0) return { range, totalCount: 0, attentionCount: 0, items: [] }
    const [opportunityRows, unresolvedComplaints, customerActions] = await Promise.all([
      db
        .select({
          id: opportunities.id,
          customerId: opportunities.customerId,
          stage: opportunities.stage,
          createdAt: opportunities.createdAt,
          expectedCloseDate: opportunities.expectedCloseDate,
          estimatedAmount: opportunities.estimatedAmount,
        })
        .from(opportunities)
        .where(
          and(
            inArray(opportunities.customerId, customerIds),
            inArray(opportunities.stage, ['intent', 'following']),
          ),
        ),
      db
        .select({ id: complaints.id, customerId: complaints.customerId })
        .from(complaints)
        .where(
          and(inArray(complaints.customerId, customerIds), eq(complaints.status, 'registered')),
        ),
      db
        .select({
          id: followUpActions.id,
          customerId: followUpActions.customerId,
          opportunityId: followUpActions.opportunityId,
          plannedAt: followUpActions.plannedAt,
        })
        .from(followUpActions)
        .where(
          and(inArray(followUpActions.customerId, customerIds), eq(followUpActions.status, 'pending')),
        ),
    ])
    const opportunityIds = opportunityRows.map((item) => item.id)
    const [quoteRows, followUpRows] = opportunityIds.length
      ? await Promise.all([
          db
            .select({
              id: opportunityQuotes.id,
              opportunityId: opportunityQuotes.opportunityId,
              kind: opportunityQuotes.kind,
              status: opportunityQuotes.status,
              amount: opportunityQuotes.amount,
              quotedAt: opportunityQuotes.quotedAt,
            })
            .from(opportunityQuotes)
            .where(inArray(opportunityQuotes.opportunityId, opportunityIds))
            .orderBy(desc(opportunityQuotes.quotedAt)),
          db
            .select({
              opportunityId: opportunityFollowUps.opportunityId,
              occurredAt: opportunityFollowUps.occurredAt,
            })
            .from(opportunityFollowUps)
            .where(inArray(opportunityFollowUps.opportunityId, opportunityIds))
            .orderBy(desc(opportunityFollowUps.occurredAt)),
        ])
      : [[], []]
    const latestQuotes = this.latestMap(
      quoteRows.filter((item) => item.status === 'active'),
      (item) => item.opportunityId,
    )
    const latestFollowUps = this.latestMap(followUpRows, (item) => item.opportunityId)
    const actionByOpportunity = new Map(
      customerActions
        .filter((item) => item.opportunityId)
        .map((item) => [item.opportunityId!, item]),
    )
    const complaintsByCustomer = this.countBy(unresolvedComplaints, (item) => item.customerId)
    const actionsByCustomer = this.groupBy(customerActions, (item) => item.customerId!)
    const opportunitiesByCustomer = this.groupBy(opportunityRows, (item) => item.customerId)
    const now = Date.now()
    const staleBoundary = now - 30 * DAY_MS

    const items = customerRows.map((customer) => {
      const reasons = new Set<string>()
      const customerOpportunities = opportunitiesByCustomer.get(customer.id) ?? []
      let openOpportunityAmount = 0
      if ((complaintsByCustomer.get(customer.id) ?? 0) > 0) reasons.add('unresolved_complaint')
      if ((actionsByCustomer.get(customer.id) ?? []).some((item) => item.plannedAt.getTime() < now)) {
        reasons.add('overdue_action')
      }
      for (const opportunity of customerOpportunities) {
        const quote = latestQuotes.get(opportunity.id) ?? null
        openOpportunityAmount += this.money(quote?.amount ?? opportunity.estimatedAmount)
        const risk = deriveOpportunityStagnation(
          opportunity,
          actionByOpportunity.get(opportunity.id) ?? null,
          quote,
          latestFollowUps.get(opportunity.id) ?? null,
        )
        for (const flag of risk.riskFlags) reasons.add(flag)
      }
      const activityAt = customer.lastActivityAt ?? customer.createdAt
      if (activityAt.getTime() < staleBoundary) reasons.add('customer_inactive_30d')
      return {
        id: customer.id,
        name: customer.name,
        grade: customer.grade,
        ownerId: customer.ownerId!,
        ownerName: customer.ownerName,
        salesRegionName: customer.salesRegionName,
        lastActivityAt: customer.lastActivityAt,
        openOpportunityCount: customerOpportunities.length,
        openOpportunityAmount,
        unresolvedComplaintCount: complaintsByCustomer.get(customer.id) ?? 0,
        reasons: [...reasons],
        needsAttention: reasons.size > 0,
      }
    })
    const gradeRank = { S: 0, A: 1 } as Record<string, number>
    items.sort(
      (a, b) =>
        Number(b.needsAttention) - Number(a.needsAttention) ||
        (gradeRank[a.grade] ?? 9) - (gradeRank[b.grade] ?? 9) ||
        b.openOpportunityAmount - a.openOpportunityAmount ||
        a.name.localeCompare(b.name),
    )
    return {
      range,
      totalCount: items.length,
      attentionCount: items.filter((item) => item.needsAttention).length,
      items,
    }
  }

  async expenses(query: ReportingQueryDto, actor: AuthUser) {
    const range = this.range(query)
    const scope = await this.scope(query, actor)
    const rows = await db
      .select()
      .from(dailyExpenses)
      .where(
        and(
          inArray(dailyExpenses.ownerId, scope.targetIds),
          sql`${dailyExpenses.expenseDate} between ${range.start} and ${range.end}`,
        ),
      )
      .orderBy(desc(dailyExpenses.expenseDate))
    const emptyAmounts = () => ({
      tobaccoAlcohol: 0,
      gifts: 0,
      dining: 0,
      entertainment: 0,
      lodging: 0,
      amount: 0,
    })
    const byOwner = new Map(
      scope.members.map((member) => [
        member.id,
        { ownerId: member.id, ownerName: member.displayName, ...emptyAmounts(), draftDays: 0 },
      ]),
    )
    const total = { ...emptyAmounts(), draftDays: 0 }
    for (const row of rows) {
      const owner = byOwner.get(row.ownerId)
      if (!owner) continue
      if (row.status === 'draft') {
        owner.draftDays += 1
        total.draftDays += 1
        continue
      }
      if (row.status !== 'submitted') continue
      for (const key of [
        'tobaccoAlcohol',
        'gifts',
        'dining',
        'entertainment',
        'lodging',
      ] as const) {
        const amount = this.money(row[key])
        owner[key] += amount
        owner.amount += amount
        total[key] += amount
        total.amount += amount
      }
    }
    return {
      range,
      total,
      byOwner: [...byOwner.values()].sort(
        (a, b) => b.amount - a.amount || a.ownerName.localeCompare(b.ownerName),
      ),
    }
  }

  private async scope(query: ReportingQueryDto, actor: AuthUser) {
    const visible = await this.accessService.getVisibleUserIds(actor)
    if (query.ownerId && !visible.includes(query.ownerId)) {
      throw new BadRequestException('所选人员不在当前管理范围内')
    }
    const targetIds = query.ownerId ? [query.ownerId] : visible
    const members = await db
      .select({ id: users.id, displayName: users.displayName, role: users.role })
      .from(users)
      .where(and(inArray(users.id, targetIds), eq(users.isActive, true)))
      .orderBy(asc(users.displayName))
    return { targetIds: members.map((item) => item.id), members }
  }

  private range(query: ReportingQueryDto): Range {
    const end = query.end ?? this.businessDate(new Date())
    const start =
      query.start ?? `${end.slice(0, 7)}-01`
    const startTime = new Date(`${start}T00:00:00`).getTime()
    const endTime = new Date(`${end}T23:59:59`).getTime()
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || startTime > endTime) {
      throw new BadRequestException('日期范围不合法')
    }
    if (endTime - startTime > 366 * DAY_MS) throw new BadRequestException('单次最多查询 366 天')
    return { start, end }
  }

  private async loadPipelineContext(
    query: ReportingQueryDto,
    targetIds: string[],
  ): Promise<PipelineContext> {
    if (targetIds.length === 0) {
      return {
        rows: [],
        quotes: [],
        latestActiveQuote: new Map(),
        firstQuote: new Map(),
        firstFormalQuote: new Map(),
        latestFollowUp: new Map(),
        currentAction: new Map(),
        dealByOpportunity: new Map(),
      }
    }
    const conditions: SQL[] = [inArray(customers.ownerId, targetIds)]
    if (query.salesRegionId) conditions.push(eq(customers.salesRegionId, query.salesRegionId))
    if (query.productLine) {
      conditions.push(sql`exists (
        select 1 from ${opportunityProductLines}
        where ${opportunityProductLines.opportunityId} = ${opportunities.id}
          and ${opportunityProductLines.productLine} = ${query.productLine}
      )`)
    }
    const rows = await db
      .select({
        id: opportunities.id,
        customerId: opportunities.customerId,
        customerName: customers.name,
        ownerId: customers.ownerId,
        ownerName: users.displayName,
        stage: opportunities.stage,
        createdAt: opportunities.createdAt,
        expectedCloseDate: opportunities.expectedCloseDate,
        closedAt: opportunities.closedAt,
        estimatedAmount: opportunities.estimatedAmount,
      })
      .from(opportunities)
      .innerJoin(customers, eq(opportunities.customerId, customers.id))
      .innerJoin(users, eq(customers.ownerId, users.id))
      .where(and(...conditions))
    const typedRows = rows as PipelineOpportunity[]
    const opportunityIds = typedRows.map((item) => item.id)
    if (opportunityIds.length === 0) {
      return {
        rows: typedRows,
        quotes: [],
        latestActiveQuote: new Map(),
        firstQuote: new Map(),
        firstFormalQuote: new Map(),
        latestFollowUp: new Map(),
        currentAction: new Map(),
        dealByOpportunity: new Map(),
      }
    }
    const [quotes, followUps, actions, dealRows] = await Promise.all([
      db
        .select({
          id: opportunityQuotes.id,
          opportunityId: opportunityQuotes.opportunityId,
          kind: opportunityQuotes.kind,
          status: opportunityQuotes.status,
          amount: opportunityQuotes.amount,
          quotedAt: opportunityQuotes.quotedAt,
        })
        .from(opportunityQuotes)
        .where(inArray(opportunityQuotes.opportunityId, opportunityIds))
        .orderBy(desc(opportunityQuotes.quotedAt)),
      db
        .select({
          opportunityId: opportunityFollowUps.opportunityId,
          occurredAt: opportunityFollowUps.occurredAt,
        })
        .from(opportunityFollowUps)
        .where(inArray(opportunityFollowUps.opportunityId, opportunityIds))
        .orderBy(desc(opportunityFollowUps.occurredAt)),
      db
        .select({ opportunityId: followUpActions.opportunityId, plannedAt: followUpActions.plannedAt })
        .from(followUpActions)
        .where(
          and(
            inArray(followUpActions.opportunityId, opportunityIds),
            eq(followUpActions.status, 'pending'),
          ),
        ),
      db
        .select({
          sourceOpportunityId: deals.sourceOpportunityId,
          amount: deals.amount,
          occurredAt: deals.occurredAt,
        })
        .from(deals)
        .where(inArray(deals.sourceOpportunityId, opportunityIds)),
    ])
    const quoteRows = quotes as QuoteRow[]
    return {
      rows: typedRows,
      quotes: quoteRows,
      latestActiveQuote: this.latestMap(
        quoteRows.filter((item) => item.status === 'active'),
        (item) => item.opportunityId,
      ),
      firstQuote: this.earliestMap(quoteRows, (item) => item.opportunityId, (item) => item.quotedAt),
      firstFormalQuote: this.earliestMap(
        quoteRows.filter((item) => item.kind === 'formal'),
        (item) => item.opportunityId,
        (item) => item.quotedAt,
      ),
      latestFollowUp: this.latestMap(followUps, (item) => item.opportunityId),
      currentAction: new Map(
        actions.filter((item) => item.opportunityId).map((item) => [item.opportunityId!, item]),
      ),
      dealByOpportunity: new Map(dealRows.map((item) => [item.sourceOpportunityId, item])),
    }
  }

  private latestMap<T>(rows: T[], key: (row: T) => string): Map<string, T> {
    const result = new Map<string, T>()
    for (const row of rows) if (!result.has(key(row))) result.set(key(row), row)
    return result
  }

  private earliestMap<T>(
    rows: T[],
    key: (row: T) => string,
    time: (row: T) => Date,
  ): Map<string, T> {
    const result = new Map<string, T>()
    for (const row of rows) {
      const existing = result.get(key(row))
      if (!existing || time(row).getTime() < time(existing).getTime()) result.set(key(row), row)
    }
    return result
  }

  private groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
    const result = new Map<string, T[]>()
    for (const row of rows) result.set(key(row), [...(result.get(key(row)) ?? []), row])
    return result
  }

  private countBy<T>(rows: T[], key: (row: T) => string): Map<string, number> {
    const result = new Map<string, number>()
    for (const row of rows) result.set(key(row), (result.get(key(row)) ?? 0) + 1)
    return result
  }

  private money(value: string | number | null | undefined): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? parsed : 0
  }

  private inRange(value: Date | string, range: Range): boolean {
    const day = value instanceof Date ? this.businessDate(value) : String(value).slice(0, 10)
    return day >= range.start && day <= range.end
  }

  private businessDate(value: Date): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value)
  }
}
