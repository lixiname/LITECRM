import { ConflictException, Injectable } from '@nestjs/common'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { AuthUser } from '../auth/auth.service'
import { CatalogService } from '../catalog/catalog.service'
import { db, type DbClient } from '../common/db/db'
import {
  deals,
  opportunities,
  opportunityEvents,
  opportunityFollowUps,
  opportunityQuotes,
} from '../common/db/schema'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import type { CloseOpportunityDto } from './dto/close-opportunity.dto'
import type { CreateOpportunityFollowUpDto } from './dto/create-opportunity-follow-up.dto'
import type { CreateOpportunityQuoteDto } from './dto/create-opportunity-quote.dto'
import type { WinOpportunityDto } from './dto/win-opportunity.dto'
import { OpportunityAccessService } from './opportunity-access.service'
import { touchCustomerActivity } from '../customers/customer-activity-projection'

/** 商机过程命令：跟进、报价、成交与未成交结案。 */
@Injectable()
export class OpportunityCommandsService {
  constructor(
    private readonly opportunityAccess: OpportunityAccessService,
    private readonly catalogService: CatalogService,
    private readonly actionsService: SalesPlansService,
  ) {}

  async addFollowUp(id: string, dto: CreateOpportunityFollowUpDto, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getEditable(id, actor)
    this.opportunityAccess.assertOpen(opportunity.stage)

    return db.transaction(async (tx) => {
      const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date()
      const [followUp] = await tx
        .insert(opportunityFollowUps)
        .values({
          opportunityId: id,
          actorId: actor.id,
          sourcePlanId: dto.sourcePlanId ?? null,
          occurredAt,
          conclusion: dto.conclusion,
          method: dto.method ?? null,
        })
        .returning()

      const quote = dto.quote
        ? await this.appendQuote(tx, {
            opportunityId: id,
            actorId: actor.id,
            followUpId: followUp.id,
            kind: dto.quote.kind,
            quotedAt: dto.quote.quotedAt ? new Date(dto.quote.quotedAt) : occurredAt,
            amount: dto.quote.amount,
            quoteNo: dto.quote.quoteNo,
            note: dto.quote.note,
            documentRef: dto.quote.documentRef,
          })
        : null

      await this.actionsService.continueWithNext(
        tx,
        dto.sourcePlanId,
        {
          planKind: 'opportunity_follow_up',
          customerId: opportunity.customerId,
          opportunityId: id,
        },
        {
          ownerId: opportunity.currentOwnerId ?? actor.id,
          customerId: opportunity.customerId,
          opportunityId: id,
          planKind: 'opportunity_follow_up',
          originType: 'opportunity_follow_up',
          sourceId: followUp.id,
          plannedAt: new Date(dto.nextActionAt),
          content: dto.nextActionContent,
        },
      )

      const nextStage = opportunity.stage === 'intent' ? 'following' : opportunity.stage
      const [updated] = await tx
        .update(opportunities)
        .set({
          stage: nextStage,
          lastFollowUpAt: occurredAt,
          updatedAt: new Date(),
          version: sql`${opportunities.version} + 1`,
        })
        .where(and(eq(opportunities.id, id), eq(opportunities.version, dto.version)))
        .returning()
      if (!updated) throw new ConflictException('商机已被更新，请刷新后重试')

      await tx.insert(opportunityEvents).values({
        opportunityId: id,
        customerId: opportunity.customerId,
        actorId: actor.id,
        occurredAt,
        type: nextStage === opportunity.stage ? 'updated' : 'stage_changed',
        payload: {
          from: opportunity.stage,
          to: nextStage,
          followUpId: followUp.id,
          quoteId: quote?.id ?? null,
        },
      })
      await touchCustomerActivity(tx, opportunity.customerId, occurredAt)
      return updated
    })
  }

  async addQuote(id: string, dto: CreateOpportunityQuoteDto, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getEditable(id, actor)
    this.opportunityAccess.assertOpen(opportunity.stage)

    return db.transaction(async (tx) => {
      const occurredAt = new Date(dto.quotedAt)
      const quote = await this.appendQuote(tx, {
        opportunityId: id,
        actorId: actor.id,
        kind: dto.kind,
        quotedAt: occurredAt,
        amount: dto.amount,
        quoteNo: dto.quoteNo,
        sourcePlanId: dto.sourcePlanId,
        note: dto.note,
        documentRef: dto.documentRef,
      })

      await this.actionsService.continueWithNext(
        tx,
        dto.sourcePlanId,
        {
          planKind: 'opportunity_follow_up',
          customerId: opportunity.customerId,
          opportunityId: id,
        },
        {
          ownerId: opportunity.currentOwnerId ?? actor.id,
          customerId: opportunity.customerId,
          opportunityId: id,
          planKind: 'opportunity_follow_up',
          originType: 'opportunity_quote',
          sourceId: quote.id,
          plannedAt: new Date(dto.nextActionAt),
          content: dto.nextActionContent,
        },
      )

      const [updated] = await tx
        .update(opportunities)
        .set({ updatedAt: new Date(), version: sql`${opportunities.version} + 1` })
        .where(and(eq(opportunities.id, id), eq(opportunities.version, dto.version)))
        .returning({ id: opportunities.id })
      if (!updated) throw new ConflictException('商机已被更新，请刷新后重试')

      await tx.insert(opportunityEvents).values({
        opportunityId: id,
        customerId: opportunity.customerId,
        actorId: actor.id,
        occurredAt,
        type: 'updated',
        payload: { quoteId: quote.id, kind: quote.kind, amount: dto.amount },
      })
      await touchCustomerActivity(tx, opportunity.customerId, occurredAt)
      return quote
    })
  }

  async win(id: string, dto: WinOpportunityDto, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getEditable(id, actor)
    this.opportunityAccess.assertOpen(opportunity.stage)
    if (dto.tradeType) await this.catalogService.assertDimensionValue('trade_type', dto.tradeType)

    try {
      return await db.transaction(async (tx) => {
        await tx.execute(
          sql`select 1 from ${opportunities} where ${opportunities.id} = ${id} for update`,
        )
        const [currentQuote] = await tx
          .select({ id: opportunityQuotes.id })
          .from(opportunityQuotes)
          .where(
            and(eq(opportunityQuotes.opportunityId, id), eq(opportunityQuotes.status, 'active')),
          )
          .limit(1)

        const occurredAt = new Date(dto.occurredAt)
        const [updated] = await tx
          .update(opportunities)
          .set({
            stage: 'won',
            closedAt: occurredAt,
            closeReason: '客户明确下单',
            updatedAt: new Date(),
            version: sql`${opportunities.version} + 1`,
          })
          .where(
            and(
              eq(opportunities.id, id),
              eq(opportunities.version, dto.version),
              inArray(opportunities.stage, ['intent', 'following']),
            ),
          )
          .returning()
        if (!updated) throw new ConflictException('商机状态已变化，请刷新后重试')

        const [deal] = await tx
          .insert(deals)
          .values({
            customerId: opportunity.customerId,
            ownerId: opportunity.currentOwnerId ?? actor.id,
            occurredAt,
            amount: String(dto.amount),
            productLine: dto.productLine ?? null,
            tradeType: dto.tradeType ?? null,
            note: dto.note ?? null,
            sourceOpportunityId: id,
            sourceQuoteId: currentQuote?.id ?? null,
          })
          .returning()
        await this.actionsService.cancelPendingForOpportunity(tx, id, '商机已确认成交')
        await tx.insert(opportunityEvents).values({
          opportunityId: id,
          customerId: opportunity.customerId,
          actorId: actor.id,
          occurredAt,
          type: 'stage_changed',
          payload: { from: opportunity.stage, to: 'won', dealId: deal.id },
        })
        await touchCustomerActivity(tx, opportunity.customerId, occurredAt, 'deal')
        return { opportunity: updated, deal }
      })
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictException('该商机已生成成交记录')
      throw error
    }
  }

  async close(id: string, dto: CloseOpportunityDto, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getEditable(id, actor)
    this.opportunityAccess.assertOpen(opportunity.stage)
    return db.transaction(async (tx) => {
      const closedAt = new Date()
      const [updated] = await tx
        .update(opportunities)
        .set({
          stage: dto.result,
          closeReason: dto.reason,
          closedAt,
          updatedAt: new Date(),
          version: sql`${opportunities.version} + 1`,
        })
        .where(and(eq(opportunities.id, id), eq(opportunities.version, dto.version)))
        .returning()
      if (!updated) throw new ConflictException('商机已被更新，请刷新后重试')
      await this.actionsService.cancelPendingForOpportunity(tx, id, `商机结案：${dto.reason}`)
      await tx.insert(opportunityEvents).values({
        opportunityId: id,
        customerId: opportunity.customerId,
        actorId: actor.id,
        occurredAt: closedAt,
        type: 'stage_changed',
        payload: { from: opportunity.stage, to: dto.result, reason: dto.reason },
      })
      await touchCustomerActivity(tx, opportunity.customerId, closedAt)
      return updated
    })
  }

  private async appendQuote(
    tx: DbClient,
    input: {
      opportunityId: string
      actorId: string
      followUpId?: string
      kind: CreateOpportunityQuoteDto['kind']
      quotedAt: Date
      amount: number
      quoteNo?: string
      sourcePlanId?: string
      note?: string
      documentRef?: string
    },
  ) {
    // 同一商机的报价必须串行更新，防止并发请求产生两条有效报价。
    await tx.execute(
      sql`select 1 from ${opportunities} where ${opportunities.id} = ${input.opportunityId} for update`,
    )
    const [currentQuote] = await tx
      .select({ id: opportunityQuotes.id })
      .from(opportunityQuotes)
      .where(
        and(
          eq(opportunityQuotes.opportunityId, input.opportunityId),
          eq(opportunityQuotes.status, 'active'),
        ),
      )
      .orderBy(desc(opportunityQuotes.createdAt))
      .limit(1)
    if (currentQuote) {
      await tx
        .update(opportunityQuotes)
        .set({
          status: 'superseded',
          updatedAt: new Date(),
          version: sql`${opportunityQuotes.version} + 1`,
        })
        .where(eq(opportunityQuotes.id, currentQuote.id))
    }
    const [quote] = await tx
      .insert(opportunityQuotes)
      .values({
        opportunityId: input.opportunityId,
        actorId: input.actorId,
        followUpId: input.followUpId ?? null,
        kind: input.kind,
        quotedAt: input.quotedAt,
        amount: String(input.amount),
        quoteNo: input.quoteNo?.trim() || null,
        supersedesQuoteId: currentQuote?.id ?? null,
        sourcePlanId: input.sourcePlanId ?? null,
        note: input.note?.trim() || null,
        documentRef: input.documentRef?.trim() || null,
      })
      .returning()
    return quote
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const value = error as { code?: string; cause?: { code?: string } }
  return value.code === '23505' || value.cause?.code === '23505'
}
