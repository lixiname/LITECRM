import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, getTableColumns, inArray } from 'drizzle-orm'
import { db } from '../common/db/db'
import { customers, deals, opportunities, opportunityEvents } from '../common/db/schema'
import { AccessService } from '../access/access.service'
import { CatalogService } from '../catalog/catalog.service'
import type { AuthUser } from '../auth/auth.service'
import type { CreateOpportunityDto } from './dto/create-opportunity.dto'
import type { AdvanceOpportunityDto } from './dto/advance-opportunity.dto'
import type { CloseOpportunityDto } from './dto/close-opportunity.dto'

/**
 * 商机闭环（§8.5 状态机）：intent → following → ordered（生成 Deal）/ lost / demand_disappeared。
 * 金额分层：opportunities.amount=意向金额（可更新）；转订单时 quoteAmount → deals.amount（成交最终值，解耦）。
 * 每次变更写 opportunity_events（只追加，业务时间，payload 快照）。
 */
@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly accessService: AccessService,
    private readonly catalogService: CatalogService,
  ) {}

  // 新建（§8.5）：意向金额+下一步必填；写 event(created)
  async create(dto: CreateOpportunityDto, actor: AuthUser) {
    await this.catalogService.assertDimensionValue('opportunity_source', dto.source)
    const customer = await this.findCustomer(dto.customerId, actor)
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)

    return db.transaction(async (tx) => {
      const [opp] = await tx
        .insert(opportunities)
        .values({
          customerId: dto.customerId,
          ownerId: actor.id, // 创建时归属快照
          name: dto.name,
          stage: 'intent',
          source: dto.source,
          productLine: dto.productLine ?? null,
          amountType: dto.amountType,
          amount: String(dto.amount),
          approximate: dto.approximate ?? false,
          amountNote: dto.amountNote ?? null,
          expectedCloseDate: dto.expectedCloseDate ?? null,
          nextAction: dto.nextAction,
          nextFollowUpDate: dto.nextFollowUpDate,
        })
        .returning()
      await tx.insert(opportunityEvents).values({
        opportunityId: opp.id,
        customerId: dto.customerId,
        actorId: actor.id,
        occurredAt: new Date(),
        type: 'created',
        payload: { name: dto.name, amount: dto.amount, amountType: dto.amountType },
      })
      return opp
    })
  }

  // 推进 / 转订单（§8.5）：stage∈intent/following；quoteAmount 非空=转订单（幂等生成 Deal）
  async advance(id: string, dto: AdvanceOpportunityDto, actor: AuthUser) {
    const opp = await this.getEditable(id, actor)
    if (opp.stage !== 'intent' && opp.stage !== 'following') {
      throw new ConflictException('当前阶段不能推进')
    }
    const toOrdered = dto.quoteAmount !== undefined
    if (toOrdered && dto.quoteAmount == null) {
      throw new BadRequestException('转订单需填写报价单金额')
    }
    const nextStage = toOrdered ? 'ordered' : 'following'

    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(opportunities)
        .set({
          stage: nextStage,
          lastFollowUpAt: new Date(),
          nextAction: dto.nextAction ?? opp.nextAction,
          nextFollowUpDate: dto.nextFollowUpDate ?? opp.nextFollowUpDate,
          closedAt: toOrdered ? new Date() : opp.closedAt,
          closeReason: toOrdered ? '转订单成交' : opp.closeReason,
        })
        .where(eq(opportunities.id, id))
        .returning()

      await tx.insert(opportunityEvents).values({
        opportunityId: id,
        customerId: opp.customerId,
        actorId: actor.id,
        occurredAt: new Date(),
        type: 'stage_changed',
        payload: {
          from: opp.stage,
          to: nextStage,
          conclusion: dto.conclusion ?? null,
          quoteAmount: dto.quoteAmount ?? null,
        },
      })

      if (toOrdered) {
        // 幂等生成 Deal（§8.5 ensureWonDeal）
        const [existing] = await tx
          .select()
          .from(deals)
          .where(eq(deals.sourceOpportunityId, id))
          .limit(1)
        if (!existing) {
          await tx.insert(deals).values({
            customerId: opp.customerId,
            ownerId: opp.ownerId,
            occurredAt: new Date(),
            amount: String(dto.quoteAmount!),
            sourceOpportunityId: id,
          })
        }
      }
      return updated
    })
  }

  // 结案（§8.5）：lost / demand_disappeared，说明必填
  async close(id: string, dto: CloseOpportunityDto, actor: AuthUser) {
    const opp = await this.getEditable(id, actor)
    if (opp.stage === 'ordered' || opp.stage === 'lost' || opp.stage === 'demand_disappeared') {
      throw new ConflictException('商机已结案')
    }
    return db.transaction(async (tx) => {
      const [updated] = await tx
        .update(opportunities)
        .set({ stage: dto.result, closeReason: dto.reason, closedAt: new Date() })
        .where(eq(opportunities.id, id))
        .returning()
      await tx.insert(opportunityEvents).values({
        opportunityId: id,
        customerId: opp.customerId,
        actorId: actor.id,
        occurredAt: new Date(),
        type: 'stage_changed',
        payload: { from: opp.stage, to: dto.result, reason: dto.reason },
      })
      return updated
    })
  }

  // 商机列表（§7.2 归属语义：可见性按客户当前 owner JOIN 推导，非商机快照）
  async list(actor: AuthUser, customerId?: string) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const conditions = [inArray(customers.ownerId, visibleIds)]
    if (customerId) conditions.push(eq(opportunities.customerId, customerId))
    return db
      .select({ ...getTableColumns(opportunities) })
      .from(opportunities)
      .innerJoin(customers, eq(opportunities.customerId, customers.id))
      .where(and(...conditions))
      .orderBy(desc(opportunities.updatedAt))
  }

  // 详情（含成交 Deal 与事件流）
  async findOne(id: string, actor: AuthUser) {
    const opp = await this.getEditable(id, actor)
    const [events, deal] = await Promise.all([
      db
        .select()
        .from(opportunityEvents)
        .where(eq(opportunityEvents.opportunityId, id))
        .orderBy(desc(opportunityEvents.occurredAt)),
      db.select().from(deals).where(eq(deals.sourceOpportunityId, id)).limit(1),
    ])
    return { ...opp, events, deal: deal[0] ?? null }
  }

  // ===== 内部工具 =====

  private async findCustomer(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [customer] = await db
      .select({ id: customers.id, ownerId: customers.ownerId })
      .from(customers)
      .where(and(eq(customers.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    return customer
  }

  // 可编辑商机：客户当前归属可见 + 客户可维护（§8.5）
  private async getEditable(id: string, actor: AuthUser) {
    const visibleIds = await this.accessService.getVisibleUserIds(actor)
    const [opp] = await db
      .select({ ...getTableColumns(opportunities), currentOwnerId: customers.ownerId })
      .from(opportunities)
      .innerJoin(customers, eq(opportunities.customerId, customers.id))
      .where(and(eq(opportunities.id, id), inArray(customers.ownerId, visibleIds)))
      .limit(1)
    if (!opp) throw new NotFoundException('商机不存在')
    await this.accessService.assertCanContributeCustomer(opp.currentOwnerId, actor)
    return opp
  }
}
