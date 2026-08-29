import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { db, type DbClient } from '../common/db/db'
import {
  complaints,
  customers,
  followUpActions,
  opportunities,
  salesPlanReschedules,
  users,
} from '../common/db/schema'
import type { FollowUpActionSourceType, SalesPlanKind } from '../common/constants'
import type { CreateSalesPlanDto } from './dto/create-follow-up-action.dto'
import type { RescheduleSalesPlanDto } from './dto/action-command.dto'
import { businessDate, todayBusinessDate } from '../common/business-date'

export interface NewLinkedAction {
  ownerId: string
  customerId?: string | null
  opportunityId?: string | null
  complaintId?: string | null
  planKind: SalesPlanKind
  originType: FollowUpActionSourceType
  sourceId?: string | null
  plannedAt: string
  content: string
}

export interface LinkedActionTarget {
  planKind: SalesPlanKind
  customerId?: string
  opportunityId?: string
  complaintId?: string
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
      .select({ ownerId: customers.ownerId, status: customers.status })
      .from(customers)
      .where(eq(customers.id, dto.customerId))
      .limit(1)
    if (!customer) throw new NotFoundException('客户不存在')
    if (customer.status !== 'active') throw new ConflictException('仅在案客户可安排业务计划')
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
          plannedAt: businessDate(dto.plannedAt),
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

  async reschedule(id: string, dto: RescheduleSalesPlanDto, actor: AuthUser) {
    await this.assertVisible(id, actor)
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select({ plannedAt: followUpActions.plannedAt })
        .from(followUpActions)
        .where(
          and(
            eq(followUpActions.id, id),
            eq(followUpActions.status, 'pending'),
            eq(followUpActions.version, dto.version),
          ),
        )
        .limit(1)
      if (!current) throw new ConflictException('行动已变化，请刷新后重试')

      const nextPlannedAt = businessDate(dto.plannedAt)
      if (current.plannedAt === nextPlannedAt) {
        throw new ConflictException('新日期与当前计划日期相同')
      }

      const [updated] = await tx
        .update(followUpActions)
        .set({
          plannedAt: nextPlannedAt,
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
      if (!updated) throw new ConflictException('行动已变化，请刷新后重试')

      await tx.insert(salesPlanReschedules).values({
        salesPlanId: id,
        fromPlannedAt: current.plannedAt,
        toPlannedAt: nextPlannedAt,
        reason: dto.reason.trim(),
        changedById: actor.id,
      })
      return updated
    })
  }

  async rescheduleHistory(id: string, actor: AuthUser) {
    await this.assertVisible(id, actor)
    return db
      .select({
        id: salesPlanReschedules.id,
        salesPlanId: salesPlanReschedules.salesPlanId,
        fromPlannedAt: salesPlanReschedules.fromPlannedAt,
        toPlannedAt: salesPlanReschedules.toPlannedAt,
        reason: salesPlanReschedules.reason,
        changedById: salesPlanReschedules.changedById,
        changedByName: users.displayName,
        occurredAt: salesPlanReschedules.occurredAt,
      })
      .from(salesPlanReschedules)
      .innerJoin(users, eq(salesPlanReschedules.changedById, users.id))
      .where(eq(salesPlanReschedules.salesPlanId, id))
      .orderBy(asc(salesPlanReschedules.occurredAt))
  }

  async fulfillLinked(tx: DbClient, planId: string | undefined, target: LinkedActionTarget) {
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

  /**
   * 业务事实发生后接续下一计划：
   * - 从计划进入：完成明确的来源计划，再创建下一计划；
   * - 直接登记：不把现有计划算作已执行。下一安排未变化时沿用，变化时留痕取消旧计划再创建新计划。
   */
  async continueWithNext(
    tx: DbClient,
    sourcePlanId: string | undefined,
    target: LinkedActionTarget,
    next: NewLinkedAction,
  ) {
    if (sourcePlanId) {
      await this.fulfillLinked(tx, sourcePlanId, target)
      return this.createLinked(tx, next)
    }

    const conditions = [
      eq(followUpActions.status, 'pending'),
      eq(followUpActions.planKind, target.planKind),
    ]
    if (target.customerId) conditions.push(eq(followUpActions.customerId, target.customerId))
    if (target.opportunityId)
      conditions.push(eq(followUpActions.opportunityId, target.opportunityId))
    if (target.complaintId) conditions.push(eq(followUpActions.complaintId, target.complaintId))
    const [existing] = await tx
      .select({
        id: followUpActions.id,
        plannedAt: followUpActions.plannedAt,
        content: followUpActions.content,
      })
      .from(followUpActions)
      .where(and(...conditions))
      .limit(1)
    if (!existing) return this.createLinked(tx, next)

    const nextContent = next.content.trim()
    if (existing.plannedAt === next.plannedAt && existing.content.trim() === nextContent) {
      return existing
    }

    const [adjusted] = await tx
      .update(followUpActions)
      .set({
        status: 'cancelled',
        cancelReason: '记录新事实后已调整下一计划',
        updatedAt: new Date(),
        version: sql`${followUpActions.version} + 1`,
      })
      .where(and(eq(followUpActions.id, existing.id), eq(followUpActions.status, 'pending')))
      .returning({ id: followUpActions.id })
    if (!adjusted) throw new ConflictException('当前计划已变化，请刷新后重试')
    return this.createLinked(tx, next)
  }

  async cancelPendingForOpportunity(tx: DbClient, opportunityId: string, reason: string) {
    await this.cancelPending(tx, eq(followUpActions.opportunityId, opportunityId), reason)
  }

  async cancelPendingForComplaint(tx: DbClient, complaintId: string, reason: string) {
    await this.cancelPending(tx, eq(followUpActions.complaintId, complaintId), reason)
  }

  async cancelPendingCustomerVisits(tx: DbClient, customerId: string, reason: string) {
    await this.cancelPending(
      tx,
      and(
        eq(followUpActions.customerId, customerId),
        eq(followUpActions.planKind, 'customer_visit'),
      )!,
      reason,
    )
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
    const today = todayBusinessDate()
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
            sql`${followUpActions.plannedAt} < ${start}`,
            sql`${followUpActions.plannedAt} < ${today}`,
          ),
        )
        .orderBy(asc(followUpActions.plannedAt)),
      query()
        .where(and(ownerCondition, sql`${followUpActions.plannedAt} between ${start} and ${end}`))
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
