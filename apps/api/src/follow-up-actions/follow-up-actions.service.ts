import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { db, type DbClient } from '../common/db/db'
import { complaints, customers, followUpActions, opportunities } from '../common/db/schema'
import type { FollowUpActionSourceType, SalesPlanKind } from '../common/constants'
import type { CreateSalesPlanDto } from './dto/create-follow-up-action.dto'
import type { ReplaceSalesPlanDto } from './dto/action-command.dto'

export interface NewLinkedAction {
  ownerId: string
  customerId?: string | null
  opportunityId?: string | null
  complaintId?: string | null
  planKind: SalesPlanKind
  originType: FollowUpActionSourceType
  sourceId?: string | null
  plannedAt: Date
  content: string
}

@Injectable()
export class SalesPlansService {
  constructor(private readonly accessService: AccessService) {}

  async createLinked(tx: DbClient, input: NewLinkedAction) {
    const [action] = await tx
      .insert(followUpActions)
      .values({
        ownerId: input.ownerId,
        customerId: input.customerId ?? null,
        opportunityId: input.opportunityId ?? null,
        complaintId: input.complaintId ?? null,
        planKind: input.planKind,
        originType: input.originType,
        sourceId: input.sourceId ?? null,
        plannedAt: input.plannedAt,
        content: input.content.trim(),
      })
      .returning()
    return action
  }

  async createManual(dto: CreateSalesPlanDto, actor: AuthUser) {
    const [customer] = await db
      .select({ ownerId: customers.ownerId })
      .from(customers)
      .where(eq(customers.id, dto.customerId))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)
    if (dto.planKind === 'customer_visit' && (dto.opportunityId || dto.complaintId)) {
      throw new ConflictException('客户拜访计划不能关联商机或客诉')
    }
    if (dto.planKind === 'opportunity_follow_up') {
      const [opportunity] = await db
        .select({ id: opportunities.id })
        .from(opportunities)
        .where(
          and(
            eq(opportunities.id, dto.opportunityId ?? ''),
            eq(opportunities.customerId, dto.customerId),
            inArray(opportunities.stage, ['intent', 'following']),
          ),
        )
        .limit(1)
      if (!opportunity) throw new ConflictException('请选择该客户仍在推进的商机')
    }
    if (dto.planKind === 'complaint_follow_up') {
      const [complaint] = await db
        .select({ id: complaints.id })
        .from(complaints)
        .where(
          and(
            eq(complaints.id, dto.complaintId ?? ''),
            eq(complaints.customerId, dto.customerId),
            eq(complaints.status, 'registered'),
          ),
        )
        .limit(1)
      if (!complaint) throw new ConflictException('请选择该客户未解决的客诉')
    }
    try {
      return await db.transaction((tx) =>
        this.createLinked(tx, {
          ownerId: actor.id,
          customerId: dto.customerId,
          opportunityId: dto.opportunityId,
          complaintId: dto.complaintId,
          planKind: dto.planKind,
          originType: 'manual',
          plannedAt: new Date(dto.plannedAt),
          content: dto.content,
        }),
      )
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('该业务已有待执行计划，请直接执行或调整原计划')
      }
      throw error
    }
  }

  async reschedule(id: string, version: number, plannedAt: string, actor: AuthUser) {
    await this.assertVisible(id, actor)
    const [updated] = await db
      .update(followUpActions)
      .set({
        plannedAt: new Date(plannedAt),
        updatedAt: new Date(),
        version: sql`${followUpActions.version} + 1`,
      })
      .where(
        and(
          eq(followUpActions.id, id),
          eq(followUpActions.status, 'pending'),
          eq(followUpActions.version, version),
        ),
      )
      .returning()
    if (!updated) throw new ConflictException('行动已变化，请刷新后重试')
    return updated
  }

  async replace(id: string, dto: ReplaceSalesPlanDto, actor: AuthUser) {
    await this.assertVisible(id, actor)
    return db.transaction(async (tx) => {
      const [replaced] = await tx
        .update(followUpActions)
        .set({
          status: 'cancelled',
          cancelReason: `计划已替换：${dto.reason.trim()}`,
          updatedAt: new Date(),
          version: sql`${followUpActions.version} + 1`,
        })
        .where(
          and(
            eq(followUpActions.id, id),
            eq(followUpActions.status, 'pending'),
            eq(followUpActions.version, dto.version),
          ),
        )
        .returning()
      if (!replaced) throw new ConflictException('计划已变化，请刷新后重试')
      const replacement = await this.createLinked(tx, {
        ownerId: replaced.ownerId,
        customerId: replaced.customerId,
        opportunityId: replaced.opportunityId,
        complaintId: replaced.complaintId,
        planKind: replaced.planKind as SalesPlanKind,
        originType: 'manual',
        plannedAt: new Date(dto.plannedAt),
        content: dto.content,
      })
      return { replaced, replacement }
    })
  }

  async fulfillLinked(
    tx: DbClient,
    planId: string | undefined,
    target: {
      planKind: SalesPlanKind
      customerId?: string
      opportunityId?: string
      complaintId?: string
    },
  ) {
    if (!planId) return
    const conditions = [
      eq(followUpActions.id, planId),
      eq(followUpActions.status, 'pending'),
      eq(followUpActions.planKind, target.planKind),
    ]
    if (target.customerId) conditions.push(eq(followUpActions.customerId, target.customerId))
    if (target.opportunityId)
      conditions.push(eq(followUpActions.opportunityId, target.opportunityId))
    if (target.complaintId) conditions.push(eq(followUpActions.complaintId, target.complaintId))
    const [updated] = await tx
      .update(followUpActions)
      .set({
        status: 'completed',
        completedAt: new Date(),
        updatedAt: new Date(),
        version: sql`${followUpActions.version} + 1`,
      })
      .where(and(...conditions))
      .returning({ id: followUpActions.id })
    if (!updated) throw new ConflictException('来源计划不存在、已执行或不属于当前业务')
  }

  async assertPendingExists(
    tx: DbClient,
    target: {
      planKind: SalesPlanKind
      customerId?: string
      opportunityId?: string
      complaintId?: string
    },
  ) {
    const conditions = [
      eq(followUpActions.status, 'pending'),
      eq(followUpActions.planKind, target.planKind),
    ]
    if (target.customerId) conditions.push(eq(followUpActions.customerId, target.customerId))
    if (target.opportunityId)
      conditions.push(eq(followUpActions.opportunityId, target.opportunityId))
    if (target.complaintId) conditions.push(eq(followUpActions.complaintId, target.complaintId))
    const [existing] = await tx
      .select({ id: followUpActions.id })
      .from(followUpActions)
      .where(and(...conditions))
      .limit(1)
    if (!existing) throw new ConflictException('没有可保留的当前计划，请明确安排下一计划')
    return existing
  }

  async cancelPendingForOpportunity(tx: DbClient, opportunityId: string, reason: string) {
    await this.cancelPending(tx, eq(followUpActions.opportunityId, opportunityId), reason)
  }

  async cancelPendingForComplaint(tx: DbClient, complaintId: string, reason: string) {
    await this.cancelPending(tx, eq(followUpActions.complaintId, complaintId), reason)
  }

  async cancelPendingForCustomer(tx: DbClient, customerId: string, reason: string) {
    await this.cancelPending(tx, eq(followUpActions.customerId, customerId), reason)
  }

  async reassignPendingForCustomer(tx: DbClient, customerId: string, ownerId: string) {
    await tx
      .update(followUpActions)
      .set({
        ownerId,
        updatedAt: new Date(),
        version: sql`${followUpActions.version} + 1`,
      })
      .where(and(eq(followUpActions.customerId, customerId), eq(followUpActions.status, 'pending')))
  }

  async listPendingForOpportunity(opportunityId: string) {
    return db
      .select()
      .from(followUpActions)
      .where(
        and(
          eq(followUpActions.opportunityId, opportunityId),
          eq(followUpActions.status, 'pending'),
        ),
      )
      .orderBy(asc(followUpActions.plannedAt))
  }

  async listPendingForComplaint(complaintId: string) {
    return db
      .select()
      .from(followUpActions)
      .where(
        and(eq(followUpActions.complaintId, complaintId), eq(followUpActions.status, 'pending')),
      )
      .orderBy(asc(followUpActions.plannedAt))
  }

  async week(actor: AuthUser, start: string, end: string, requestedOwnerId?: string) {
    const ownerId = await this.accessService.resolveVisibleUserId(actor, requestedOwnerId)
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
    const ownerCondition = eq(followUpActions.ownerId, ownerId)
    const projection = {
      ...getTableColumns(followUpActions),
      customerName: customers.name,
      opportunityName: opportunities.name,
    }
    const query = () =>
      db
        .select(projection)
        .from(followUpActions)
        .innerJoin(customers, eq(followUpActions.customerId, customers.id))
        .leftJoin(opportunities, eq(followUpActions.opportunityId, opportunities.id))
    const [overdue, ranged] = await Promise.all([
      query()
        .where(
          and(
            ownerCondition,
            eq(followUpActions.status, 'pending'),
            sql`(${followUpActions.plannedAt} at time zone 'Asia/Shanghai')::date < ${start}`,
            sql`(${followUpActions.plannedAt} at time zone 'Asia/Shanghai')::date < ${today}`,
          ),
        )
        .orderBy(asc(followUpActions.plannedAt)),
      query()
        .where(
          and(
            ownerCondition,
            sql`(${followUpActions.plannedAt} at time zone 'Asia/Shanghai')::date between ${start} and ${end}`,
          ),
        )
        .orderBy(asc(followUpActions.plannedAt)),
    ])
    return { overdue, plans: ranged }
  }

  async findOne(id: string, actor: AuthUser) {
    await this.assertVisible(id, actor)
    const [plan] = await db
      .select()
      .from(followUpActions)
      .where(eq(followUpActions.id, id))
      .limit(1)
    if (!plan) throw new NotFoundException('销售计划不存在')
    return plan
  }

  private async cancelPending(tx: DbClient, target: ReturnType<typeof eq>, reason: string) {
    await tx
      .update(followUpActions)
      .set({
        status: 'cancelled',
        cancelReason: reason,
        updatedAt: new Date(),
        version: sql`${followUpActions.version} + 1`,
      })
      .where(and(target, eq(followUpActions.status, 'pending')))
  }

  private async assertVisible(id: string, actor: AuthUser) {
    const visible = await this.accessService.getVisibleUserIds(actor)
    const [action] = await db
      .select({ id: followUpActions.id })
      .from(followUpActions)
      .where(and(eq(followUpActions.id, id), inArray(followUpActions.ownerId, visible)))
      .limit(1)
    if (!action) throw new NotFoundException('行动不存在')
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const value = error as { code?: string; cause?: { code?: string } }
  return value.code === '23505' || value.cause?.code === '23505'
}
