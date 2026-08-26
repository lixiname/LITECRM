import { ConflictException, Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { AuthUser } from '../auth/auth.service'
import { CatalogService } from '../catalog/catalog.service'
import { db } from '../common/db/db'
import {
  deals,
  opportunities,
  opportunityEvents,
  opportunityFollowUps,
  opportunityQuotes,
  visitRecords,
} from '../common/db/schema'
import { FollowUpActionsService } from '../follow-up-actions/follow-up-actions.service'
import type { CloseOpportunityDto } from './dto/close-opportunity.dto'
import type { CreateOpportunityFollowUpDto } from './dto/create-opportunity-follow-up.dto'
import type { CreateOpportunityQuoteDto } from './dto/create-opportunity-quote.dto'
import type { WinOpportunityDto } from './dto/win-opportunity.dto'
import { OpportunityAccessService } from './opportunity-access.service'

/** 商机过程命令：跟进、报价、成交与未成交结案。 */
@Injectable()
export class OpportunityCommandsService {
  constructor(
    private readonly opportunityAccess: OpportunityAccessService,
    private readonly catalogService: CatalogService,
    private readonly actionsService: FollowUpActionsService,
  ) {}

  async addFollowUp(id: string, dto: CreateOpportunityFollowUpDto, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getEditable(id, actor)
    this.opportunityAccess.assertOpen(opportunity.stage)

    return db.transaction(async (tx) => {
      if (dto.sourceVisitId) {
        const [visit] = await tx
          .select({ id: visitRecords.id })
          .from(visitRecords)
          .where(
            and(
              eq(visitRecords.id, dto.sourceVisitId),
              eq(visitRecords.customerId, opportunity.customerId),
            ),
          )
          .limit(1)
        if (!visit) throw new ConflictException('来源拜访不属于该商机客户')
      }

      const occurredAt = dto.occurredAt ? new Date(dto.occurredAt) : new Date()
      const [followUp] = await tx
        .insert(opportunityFollowUps)
        .values({
          opportunityId: id,
          actorId: actor.id,
          sourceVisitId: dto.sourceVisitId ?? null,
          occurredAt,
          conclusion: dto.conclusion,
          method: dto.method ?? null,
        })
        .returning()

      await this.actionsService.completeLinked(tx, dto.sourceActionId, { opportunityId: id })
      await this.actionsService.createLinked(tx, {
        ownerId: opportunity.currentOwnerId ?? actor.id,
        customerId: opportunity.customerId,
        opportunityId: id,
        sourceType: 'opportunity_follow_up',
        sourceId: followUp.id,
        plannedAt: new Date(dto.nextActionAt),
        content: dto.nextActionContent,
      })

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
        payload: { from: opportunity.stage, to: nextStage, followUpId: followUp.id },
      })
      return updated
    })
  }

  async addQuote(id: string, dto: CreateOpportunityQuoteDto, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getEditable(id, actor)
    this.opportunityAccess.assertOpen(opportunity.stage)

    return db.transaction(async (tx) => {
      if (dto.supersedesQuoteId) {
        const [superseded] = await tx
          .update(opportunityQuotes)
          .set({
            status: 'superseded',
            updatedAt: new Date(),
            version: sql`${opportunityQuotes.version} + 1`,
          })
          .where(
            and(
              eq(opportunityQuotes.id, dto.supersedesQuoteId),
              eq(opportunityQuotes.opportunityId, id),
              eq(opportunityQuotes.status, 'active'),
            ),
          )
          .returning({ id: opportunityQuotes.id })
        if (!superseded) throw new ConflictException('被替代报价不存在、已失效或不属于该商机')
      }

      const [quote] = await tx
        .insert(opportunityQuotes)
        .values({
          opportunityId: id,
          actorId: actor.id,
          kind: dto.kind,
          quotedAt: new Date(dto.quotedAt),
          amount: String(dto.amount),
          quoteNo: dto.quoteNo?.trim() || null,
          supersedesQuoteId: dto.supersedesQuoteId ?? null,
          note: dto.note?.trim() || null,
          documentRef: dto.documentRef?.trim() || null,
        })
        .returning()

      await this.actionsService.completeLinked(tx, dto.sourceActionId, { opportunityId: id })
      await this.actionsService.createLinked(tx, {
        ownerId: opportunity.currentOwnerId ?? actor.id,
        customerId: opportunity.customerId,
        opportunityId: id,
        sourceType: 'opportunity_quote',
        sourceId: quote.id,
        plannedAt: new Date(dto.nextActionAt),
        content: dto.nextActionContent,
      })

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
        occurredAt: new Date(dto.quotedAt),
        type: 'updated',
        payload: { quoteId: quote.id, kind: quote.kind, amount: dto.amount },
      })
      return quote
    })
  }

  async win(id: string, dto: WinOpportunityDto, actor: AuthUser) {
    const opportunity = await this.opportunityAccess.getEditable(id, actor)
    this.opportunityAccess.assertOpen(opportunity.stage)
    if (dto.tradeType) await this.catalogService.assertDimensionValue('trade_type', dto.tradeType)

    try {
      return await db.transaction(async (tx) => {
        if (dto.acceptedQuoteId) {
          const [quote] = await tx
            .select({ id: opportunityQuotes.id })
            .from(opportunityQuotes)
            .where(
              and(
                eq(opportunityQuotes.id, dto.acceptedQuoteId),
                eq(opportunityQuotes.opportunityId, id),
                eq(opportunityQuotes.status, 'active'),
              ),
            )
            .limit(1)
          if (!quote) throw new ConflictException('接受的报价不存在、已失效或不属于该商机')
        }

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
            productLine: dto.productLine ?? opportunity.productLine,
            tradeType: dto.tradeType ?? null,
            note: dto.note ?? null,
            sourceOpportunityId: id,
            sourceQuoteId: dto.acceptedQuoteId ?? null,
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
      return updated
    })
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const value = error as { code?: string; cause?: { code?: string } }
  return value.code === '23505' || value.cause?.code === '23505'
}
