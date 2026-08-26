import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { db, type DbClient } from '../common/db/db'
import { customers, followUpActions } from '../common/db/schema'
import type { FollowUpActionSourceType } from '../common/constants'
import type { CreateFollowUpActionDto } from './dto/create-follow-up-action.dto'

export interface NewLinkedAction {
  ownerId: string
  customerId?: string | null
  opportunityId?: string | null
  complaintId?: string | null
  sourceType: FollowUpActionSourceType
  sourceId?: string | null
  plannedAt: Date
  content: string
}

@Injectable()
export class FollowUpActionsService {
  constructor(private readonly accessService: AccessService) {}

  async createLinked(tx: DbClient, input: NewLinkedAction) {
    const [action] = await tx
      .insert(followUpActions)
      .values({
        ownerId: input.ownerId,
        customerId: input.customerId ?? null,
        opportunityId: input.opportunityId ?? null,
        complaintId: input.complaintId ?? null,
        sourceType: input.sourceType,
        sourceId: input.sourceId ?? null,
        plannedAt: input.plannedAt,
        content: input.content.trim(),
      })
      .returning()
    return action
  }

  async createManual(dto: CreateFollowUpActionDto, actor: AuthUser) {
    if (dto.customerId) {
      const [customer] = await db
        .select({ ownerId: customers.ownerId })
        .from(customers)
        .where(eq(customers.id, dto.customerId))
        .limit(1)
      if (!customer) throw new NotFoundException('客户不存在')
      await this.accessService.assertCanContributeCustomer(customer.ownerId, actor)
    }
    return db.transaction((tx) =>
      this.createLinked(tx, {
        ownerId: actor.id,
        customerId: dto.customerId,
        sourceType: 'manual',
        plannedAt: new Date(dto.plannedAt),
        content: dto.content,
      }),
    )
  }

  async complete(id: string, version: number, actor: AuthUser) {
    await this.assertVisible(id, actor)
    const [updated] = await db
      .update(followUpActions)
      .set({
        status: 'completed',
        completedAt: new Date(),
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

  async cancel(id: string, version: number, reason: string, actor: AuthUser) {
    await this.assertVisible(id, actor)
    const [updated] = await db
      .update(followUpActions)
      .set({
        status: 'cancelled',
        cancelReason: reason.trim(),
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

  async completeLinked(
    tx: DbClient,
    actionId: string | undefined,
    target: { opportunityId?: string; complaintId?: string },
  ) {
    if (!actionId) return
    const conditions = [eq(followUpActions.id, actionId), eq(followUpActions.status, 'pending')]
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
    if (!updated) throw new ConflictException('来源行动不存在、已完成或不属于当前业务')
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

  async week(actor: AuthUser, start: string, end: string) {
    const visible = await this.accessService.getVisibleUserIds(actor)
    const today = new Date().toISOString().slice(0, 10)
    const base = [inArray(followUpActions.ownerId, visible), eq(followUpActions.status, 'pending')]
    const [overdue, ranged] = await Promise.all([
      db
        .select()
        .from(followUpActions)
        .where(
          and(
            ...base,
            sql`${followUpActions.plannedAt}::date < ${start}`,
            sql`${followUpActions.plannedAt}::date < ${today}`,
          ),
        )
        .orderBy(asc(followUpActions.plannedAt)),
      db
        .select()
        .from(followUpActions)
        .where(and(...base, sql`${followUpActions.plannedAt}::date between ${start} and ${end}`))
        .orderBy(asc(followUpActions.plannedAt)),
    ])
    return { overdue, actions: ranged }
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
