import { BadRequestException, Injectable } from '@nestjs/common'
import { and, asc, desc, eq, getTableColumns, gte, inArray, lte, sql, type SQL } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { CatalogService } from '../catalog/catalog.service'
import { db } from '../common/db/db'
import {
  customers,
  deals,
  followUpActions,
  opportunities,
  opportunityEvents,
  opportunityFollowUps,
  opportunityProductLines,
  opportunityQuotes,
  users,
} from '../common/db/schema'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import type { CreateOpportunityDto } from './dto/create-opportunity.dto'
import { OpportunityAccessService } from './opportunity-access.service'
import { touchCustomerActivity } from '../customers/customer-activity-projection'
import type { OpportunityQueryDto } from './dto/opportunity-query.dto'
import { deriveOpportunityStagnation, opportunityStagnationSql } from './opportunity-stagnation'

/** 商机创建与查询；过程命令由 OpportunityCommandsService 承担。 */
@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly accessService: AccessService,
    private readonly opportunityAccess: OpportunityAccessService,
    private readonly catalogService: CatalogService,
    private readonly actionsService: SalesPlansService,
  ) {}

  async create(dto: CreateOpportunityDto, actor: AuthUser) {
    await this.catalogService.assertDimensionValue('opportunity_source', dto.source)
    const productLines = [...new Set(dto.productLines ?? [])]
    await Promise.all(
      productLines.map((value) => this.catalogService.assertDimensionValue('product_line', value)),
    )
    const customer = await this.opportunityAccess.findCustomer(dto.customerId, actor)
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)

    return db.transaction(async (tx) => {
      const occurredAt = new Date()
      const isQuoteBorn = dto.initialAmountBasis !== 'estimate'
      const [opportunity] = await tx
        .insert(opportunities)
        .values({
          customerId: dto.customerId,
          ownerId: actor.id,
          name: dto.name,
          source: dto.source,
          stage: isQuoteBorn ? 'following' : 'intent',
          initialAmountBasis: dto.initialAmountBasis,
          estimatedAmount: dto.initialAmountBasis === 'estimate' ? String(dto.initialAmount) : null,
          approximate: dto.approximate ?? false,
          estimateNote: dto.estimateNote ?? null,
          discoveredDate: dto.discoveredDate ?? null,
          expectedCloseDate: dto.expectedCloseDate ?? null,
        })
        .returning()
      if (productLines.length) {
        await tx.insert(opportunityProductLines).values(
          productLines.map((productLine) => ({ opportunityId: opportunity.id, productLine })),
        )
      }
      const initialQuote = isQuoteBorn
        ? (
            await tx
              .insert(opportunityQuotes)
              .values({
                opportunityId: opportunity.id,
                actorId: actor.id,
                kind: dto.initialAmountBasis === 'formal_quote' ? 'formal' : 'oral',
                quotedAt: dto.initialQuotedAt ? new Date(dto.initialQuotedAt) : occurredAt,
                amount: String(dto.initialAmount),
                quoteNo:
                  dto.initialAmountBasis === 'formal_quote'
                    ? dto.initialQuoteNo?.trim() || null
                    : null,
                note: dto.estimateNote?.trim() || null,
                documentRef:
                  dto.initialAmountBasis === 'formal_quote'
                    ? dto.initialQuoteDocumentRef?.trim() || null
                    : null,
              })
              .returning()
          )[0]
        : null
      await tx.insert(opportunityEvents).values({
        opportunityId: opportunity.id,
        customerId: dto.customerId,
        actorId: actor.id,
        occurredAt,
        type: 'created',
        payload: {
          name: dto.name,
          initialAmountBasis: dto.initialAmountBasis,
          initialAmount: dto.initialAmount,
          quoteId: initialQuote?.id,
        },
      })
      await this.actionsService.createLinked(tx, {
        ownerId: customer.ownerId ?? actor.id,
        customerId: dto.customerId,
        opportunityId: opportunity.id,
        planKind: 'opportunity_follow_up',
        originType: initialQuote ? 'opportunity_quote' : 'opportunity',
        sourceId: initialQuote?.id ?? opportunity.id,
        plannedAt: new Date(dto.firstActionAt),
        content: dto.firstActionContent,
      })
      await touchCustomerActivity(tx, dto.customerId, occurredAt)
      return {
        ...opportunity,
        productLines,
        latestQuote: initialQuote,
        referenceAmount: initialQuote?.amount ?? opportunity.estimatedAmount,
        amountBasis: initialQuote ? dto.initialAmountBasis : 'estimate',
      }
    })
  }

  async list(query: OpportunityQueryDto, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const conditions: SQL[] = [inArray(customers.ownerId, visibleIds)]
    const keyword = query.keyword?.trim()
    if (keyword) {
      conditions.push(
        sql`(${opportunities.name} ILIKE ${`%${keyword}%`} OR ${customers.name} ILIKE ${`%${keyword}%`})`,
      )
    }
    if (query.customerId) conditions.push(eq(opportunities.customerId, query.customerId))
    if (query.ownerId) {
      if (!visibleIds.includes(query.ownerId)) throw new BadRequestException('负责人不在可见范围内')
      conditions.push(eq(customers.ownerId, query.ownerId))
    }
    if (query.salesRegionId) conditions.push(eq(customers.salesRegionId, query.salesRegionId))
    if (query.productLine) {
      conditions.push(sql`exists (
        select 1 from ${opportunityProductLines}
        where ${opportunityProductLines.opportunityId} = ${opportunities.id}
          and ${opportunityProductLines.productLine} = ${query.productLine}
      )`)
    }
    if (query.stage) conditions.push(eq(opportunities.stage, query.stage))
    if (query.minAmount !== undefined) {
      conditions.push(gte(this.referenceAmountSql(), String(query.minAmount)))
    }
    if (query.maxAmount !== undefined) {
      conditions.push(lte(this.referenceAmountSql(), String(query.maxAmount)))
    }
    if (query.hasQuote !== undefined) {
      const quoteExists = sql`exists (
        select 1 from ${opportunityQuotes}
        where ${opportunityQuotes.opportunityId} = ${opportunities.id}
      )`
      conditions.push(query.hasQuote ? quoteExists : sql`not ${quoteExists}`)
    }
    if (query.noNextAction !== undefined) {
      const pendingActionExists = sql`exists (
        select 1 from ${followUpActions}
        where ${followUpActions.opportunityId} = ${opportunities.id}
          and ${followUpActions.status} = 'pending'
      )`
      conditions.push(
        query.noNextAction
          ? sql`${opportunities.stage} in ('intent', 'following') and not ${pendingActionExists}`
          : pendingActionExists,
      )
    }
    if (query.stagnant !== undefined) {
      const riskExists = opportunityStagnationSql()
      conditions.push(
        query.stagnant
          ? riskExists
          : sql`${opportunities.stage} in ('intent', 'following') and not (${riskExists})`,
      )
    }

    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    const where = and(...conditions)
    const [totalRows, rows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(opportunities)
        .innerJoin(customers, eq(opportunities.customerId, customers.id))
        .where(where),
      db
        .select({
          ...getTableColumns(opportunities),
          customerName: customers.name,
          currentOwnerId: customers.ownerId,
        })
        .from(opportunities)
        .innerJoin(customers, eq(opportunities.customerId, customers.id))
        .where(where)
        .orderBy(desc(opportunities.updatedAt), asc(opportunities.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ])
    if (rows.length === 0) {
      return { items: [], total: totalRows[0]?.count ?? 0, page, pageSize }
    }

    const ids = rows.map((row) => row.id)
    const ownerIds = [
      ...new Set(rows.flatMap((row) => (row.currentOwnerId ? [row.currentOwnerId] : []))),
    ]
    const [actions, quotes, followUps, productLineRows, ownerRows] = await Promise.all([
      db
        .select()
        .from(followUpActions)
        .where(
          and(inArray(followUpActions.opportunityId, ids), eq(followUpActions.status, 'pending')),
        )
        .orderBy(asc(followUpActions.plannedAt)),
      db
        .select()
        .from(opportunityQuotes)
        .where(inArray(opportunityQuotes.opportunityId, ids))
        .orderBy(desc(opportunityQuotes.quotedAt)),
      db
        .select()
        .from(opportunityFollowUps)
        .where(inArray(opportunityFollowUps.opportunityId, ids))
        .orderBy(desc(opportunityFollowUps.occurredAt)),
      db
        .select()
        .from(opportunityProductLines)
        .where(inArray(opportunityProductLines.opportunityId, ids)),
      ownerIds.length
        ? db
            .select({ id: users.id, displayName: users.displayName })
            .from(users)
            .where(inArray(users.id, ownerIds))
        : Promise.resolve([]),
    ])
    const items = rows.map((row) => {
      const currentAction = actions.find((action) => action.opportunityId === row.id) ?? null
      const latestQuote =
        quotes.find((quote) => quote.opportunityId === row.id && quote.status === 'active') ?? null
      const latestFollowUp = followUps.find((item) => item.opportunityId === row.id) ?? null
      return {
        ...row,
        currentOwnerName:
          ownerRows.find((owner) => owner.id === row.currentOwnerId)?.displayName ?? null,
        currentAction,
        latestQuote,
        latestFollowUp,
        productLines: productLineRows
          .filter((item) => item.opportunityId === row.id)
          .map((item) => item.productLine),
        referenceAmount: latestQuote?.amount ?? row.estimatedAmount,
        amountBasis: latestQuote ? `${latestQuote.kind}_quote` : row.initialAmountBasis,
        ...deriveOpportunityStagnation(row, currentAction, latestQuote, latestFollowUp),
      }
    })
    return { items, total: totalRows[0]?.count ?? 0, page, pageSize }
  }

  async findOne(id: string, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getVisible(id, actor)
    const [followUps, quotes, productLineRows, events, deal, actions, owner] = await Promise.all([
      db
        .select()
        .from(opportunityFollowUps)
        .where(eq(opportunityFollowUps.opportunityId, id))
        .orderBy(desc(opportunityFollowUps.occurredAt)),
      db
        .select()
        .from(opportunityQuotes)
        .where(eq(opportunityQuotes.opportunityId, id))
        .orderBy(desc(opportunityQuotes.quotedAt)),
      db
        .select()
        .from(opportunityProductLines)
        .where(eq(opportunityProductLines.opportunityId, id)),
      db
        .select()
        .from(opportunityEvents)
        .where(eq(opportunityEvents.opportunityId, id))
        .orderBy(desc(opportunityEvents.occurredAt)),
      db.select().from(deals).where(eq(deals.sourceOpportunityId, id)).limit(1),
      this.actionsService.listPendingForOpportunity(id),
      opportunity.currentOwnerId
        ? db
            .select({ displayName: users.displayName })
            .from(users)
            .where(eq(users.id, opportunity.currentOwnerId))
            .limit(1)
        : Promise.resolve([]),
    ])
    return {
      ...opportunity,
      currentOwnerName: owner[0]?.displayName ?? null,
      followUps,
      quotes,
      productLines: productLineRows.map((item) => item.productLine),
      referenceAmount:
        quotes.find((quote) => quote.status === 'active')?.amount ?? opportunity.estimatedAmount,
      amountBasis: quotes.find((quote) => quote.status === 'active')
        ? `${quotes.find((quote) => quote.status === 'active')!.kind}_quote`
        : opportunity.initialAmountBasis,
      events,
      actions,
      deal: deal[0] ?? null,
      ...deriveOpportunityStagnation(
        opportunity,
        actions[0] ?? null,
        quotes[0] ?? null,
        followUps[0] ?? null,
      ),
    }
  }

  private referenceAmountSql(): SQL {
    return sql`coalesce((
      select ${opportunityQuotes.amount}
      from ${opportunityQuotes}
      where ${opportunityQuotes.opportunityId} = ${opportunities.id}
        and ${opportunityQuotes.status} = 'active'
      order by ${opportunityQuotes.quotedAt} desc
      limit 1
    ), ${opportunities.estimatedAmount})`
  }
}
