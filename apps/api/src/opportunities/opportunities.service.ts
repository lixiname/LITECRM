import { Injectable } from '@nestjs/common'
import { and, asc, desc, eq, getTableColumns, inArray } from 'drizzle-orm'
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
  opportunityQuotes,
} from '../common/db/schema'
import { FollowUpActionsService } from '../follow-up-actions/follow-up-actions.service'
import type { CreateOpportunityDto } from './dto/create-opportunity.dto'
import { OpportunityAccessService } from './opportunity-access.service'

/** 商机创建与查询；过程命令由 OpportunityCommandsService 承担。 */
@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly accessService: AccessService,
    private readonly opportunityAccess: OpportunityAccessService,
    private readonly catalogService: CatalogService,
    private readonly actionsService: FollowUpActionsService,
  ) {}

  async create(dto: CreateOpportunityDto, actor: AuthUser) {
    await this.catalogService.assertDimensionValue('opportunity_source', dto.source)
    const customer = await this.opportunityAccess.findCustomer(dto.customerId, actor)
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)

    return db.transaction(async (tx) => {
      const [opportunity] = await tx
        .insert(opportunities)
        .values({
          customerId: dto.customerId,
          ownerId: actor.id,
          name: dto.name,
          source: dto.source,
          productLine: dto.productLine ?? null,
          estimatedAmount: String(dto.estimatedAmount),
          approximate: dto.approximate ?? false,
          estimateNote: dto.estimateNote ?? null,
          discoveredDate: dto.discoveredDate ?? null,
          expectedCloseDate: dto.expectedCloseDate ?? null,
        })
        .returning()
      await tx.insert(opportunityEvents).values({
        opportunityId: opportunity.id,
        customerId: dto.customerId,
        actorId: actor.id,
        occurredAt: new Date(),
        type: 'created',
        payload: { name: dto.name, estimatedAmount: dto.estimatedAmount },
      })
      await this.actionsService.createLinked(tx, {
        ownerId: customer.ownerId ?? actor.id,
        customerId: dto.customerId,
        opportunityId: opportunity.id,
        sourceType: 'opportunity',
        sourceId: opportunity.id,
        plannedAt: new Date(dto.firstActionAt),
        content: dto.firstActionContent,
      })
      return opportunity
    })
  }

  async list(actor: AuthUser, customerId?: string) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const conditions = [inArray(customers.ownerId, visibleIds)]
    if (customerId) conditions.push(eq(opportunities.customerId, customerId))
    const rows = await db
      .select({ ...getTableColumns(opportunities), customerName: customers.name })
      .from(opportunities)
      .innerJoin(customers, eq(opportunities.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(opportunities.updatedAt))
    if (rows.length === 0) return []

    const ids = rows.map((row) => row.id)
    const [actions, quotes] = await Promise.all([
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
    ])
    return rows.map((row) => ({
      ...row,
      currentAction: actions.find((action) => action.opportunityId === row.id) ?? null,
      latestQuote: quotes.find((quote) => quote.opportunityId === row.id) ?? null,
    }))
  }

  async findOne(id: string, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getEditable(id, actor)
    const [followUps, quotes, events, deal, actions] = await Promise.all([
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
        .from(opportunityEvents)
        .where(eq(opportunityEvents.opportunityId, id))
        .orderBy(desc(opportunityEvents.occurredAt)),
      db.select().from(deals).where(eq(deals.sourceOpportunityId, id)).limit(1),
      this.actionsService.listPendingForOpportunity(id),
    ])
    return { ...opportunity, followUps, quotes, events, actions, deal: deal[0] ?? null }
  }
}
