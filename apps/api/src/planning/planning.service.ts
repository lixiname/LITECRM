import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, desc, eq, gte, inArray, isNull, lte, sql } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { db } from '../common/db/db'
import {
  businessWeeks,
  alertReads,
  followUpActions,
  managementComments,
  users,
  weeklyPlans,
} from '../common/db/schema'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import type { CreateBusinessWeekDto } from './dto/create-business-week.dto'
import type { CreatePlanCommentDto } from './dto/create-comment.dto'
import type { CreatePlanItemDto } from './dto/create-plan-item.dto'

@Injectable()
export class PlanningService {
  constructor(
    private readonly accessService: AccessService,
    private readonly actionsService: SalesPlansService,
  ) {}

  async createBusinessWeek(dto: CreateBusinessWeekDto) {
    const [week] = await db.insert(businessWeeks).values(dto).onConflictDoNothing().returning()
    if (!week) throw new ConflictException('该周起始日已存在业务周')
    return week
  }

  async listBusinessWeeks() {
    return db.select().from(businessWeeks).orderBy(desc(businessWeeks.weekStart))
  }

  async getMyPlan(businessWeekId: string, actor: AuthUser) {
    const [week] = await db
      .select()
      .from(businessWeeks)
      .where(eq(businessWeeks.id, businessWeekId))
      .limit(1)
    if (!week) throw new NotFoundException('业务周不存在')
    const [plan] = await db
      .select()
      .from(weeklyPlans)
      .where(and(eq(weeklyPlans.ownerId, actor.id), eq(weeklyPlans.businessWeekId, businessWeekId)))
      .limit(1)
    const actions = await db
      .select()
      .from(followUpActions)
      .where(
        and(
          eq(followUpActions.ownerId, actor.id),
          sql`${followUpActions.plannedAt}::date between ${week.weekStart} and ${week.weekEnd}`,
        ),
      )
      .orderBy(followUpActions.plannedAt)
    return plan ? { ...plan, actions } : { plan: null, actions }
  }

  // 周视图新增的是有明确业务归属的计划，不创建通用待办。
  async addPlanItemByDate(dto: CreatePlanItemDto, actor: AuthUser) {
    return this.actionsService.createManual(
      {
        planKind: dto.planKind,
        plannedAt: dto.plannedAt,
        content: dto.content,
        customerId: dto.customerId,
        opportunityId: dto.opportunityId,
      },
      actor,
    )
  }

  async addPlanItem(planId: string, dto: CreatePlanItemDto, actor: AuthUser) {
    const [row] = await db
      .select({ plan: weeklyPlans, week: businessWeeks })
      .from(weeklyPlans)
      .innerJoin(businessWeeks, eq(weeklyPlans.businessWeekId, businessWeeks.id))
      .where(eq(weeklyPlans.id, planId))
      .limit(1)
    if (!row || row.plan.ownerId !== actor.id)
      throw new ForbiddenException('仅本人周计划可添加行动')
    const plannedDate = dto.plannedAt.slice(0, 10)
    if (plannedDate < row.week.weekStart || plannedDate > row.week.weekEnd) {
      throw new ConflictException('行动日期需在业务周内')
    }
    return this.addPlanItemByDate(dto, actor)
  }

  async createPlanComment(planId: string, dto: CreatePlanCommentDto, actor: AuthUser) {
    const plan = await this.findPlanForComments(planId, actor)
    if (plan.status !== 'pending') throw new ConflictException('已结束计划不再接受新的指导留言')
    if (actor.role === 'admin' || !this.accessService.can(actor.role, 'dashboard.view')) {
      throw new ForbiddenException('仅承担团队管理职责的上级可发布指导留言')
    }
    const isManager = await this.accessService.isManagerOf(actor.id, plan.ownerId)
    if (!isManager) throw new ForbiddenException('仅计划负责人的上级可发布指导留言')
    const [comment] = await db
      .insert(managementComments)
      .values({
        targetType: 'follow_up_action',
        targetId: planId,
        ownerId: plan.ownerId,
        authorId: actor.id,
        content: dto.content.trim(),
      })
      .returning()
    return comment
  }

  async listPlanComments(planId: string, actor: AuthUser) {
    await this.findPlanForComments(planId, actor)
    const comments = await db
      .select()
      .from(managementComments)
      .where(
        and(
          eq(managementComments.targetType, 'follow_up_action'),
          eq(managementComments.targetId, planId),
        ),
      )
      .orderBy(asc(managementComments.createdAt))
    const userIds = [...new Set(comments.flatMap((item) => [item.authorId, item.ownerId]))]
    const people = userIds.length
      ? await db
          .select({ id: users.id, displayName: users.displayName })
          .from(users)
          .where(inArray(users.id, userIds))
      : []
    const nameById = new Map(people.map((item) => [item.id, item.displayName]))
    return comments.map((item) => ({
      ...item,
      authorName: nameById.get(item.authorId) ?? '未知人员',
      ownerName: nameById.get(item.ownerId) ?? '未知人员',
    }))
  }

  async markPlanCommentsRead(planId: string, actor: AuthUser) {
    const [plan] = await db
      .select({ ownerId: followUpActions.ownerId })
      .from(followUpActions)
      .where(and(eq(followUpActions.id, planId), eq(followUpActions.ownerId, actor.id)))
      .limit(1)
    if (!plan) throw new NotFoundException('计划不存在或不属于当前用户')
    const unread = await db
      .select({ id: managementComments.id })
      .from(managementComments)
      .where(
        and(
          eq(managementComments.targetType, 'follow_up_action'),
          eq(managementComments.targetId, planId),
          eq(managementComments.ownerId, actor.id),
          isNull(managementComments.readAt),
        ),
      )
    if (!unread.length) return { readCount: 0 }
    const readAt = new Date()
    await db.transaction(async (tx) => {
      await tx
        .update(managementComments)
        .set({
          readAt,
          updatedAt: readAt,
          version: sql`${managementComments.version} + 1`,
        })
        .where(
          inArray(
            managementComments.id,
            unread.map((item) => item.id),
          ),
        )
      await tx
        .insert(alertReads)
        .values(
          unread.map((item) => ({
            userId: actor.id,
            alertKey: `management-comment:${item.id}`,
            readAt,
          })),
        )
        .onConflictDoUpdate({
          target: [alertReads.userId, alertReads.alertKey],
          set: { readAt, updatedAt: readAt, version: sql`${alertReads.version} + 1` },
        })
    })
    return { readCount: unread.length }
  }

  private async findPlanForComments(planId: string, actor: AuthUser) {
    const visibleOwnerIds = await this.accessService.getVisibleUserIds(actor)
    const [plan] = await db
      .select({
        id: followUpActions.id,
        ownerId: followUpActions.ownerId,
        status: followUpActions.status,
      })
      .from(followUpActions)
      .where(and(eq(followUpActions.id, planId), inArray(followUpActions.ownerId, visibleOwnerIds)))
      .limit(1)
    if (!plan) throw new NotFoundException('计划不存在或无权查看')
    return plan
  }

  async findBusinessWeekByDate(date: string) {
    const [week] = await db
      .select()
      .from(businessWeeks)
      .where(
        and(
          eq(businessWeeks.isActive, true),
          lte(businessWeeks.weekStart, date),
          gte(businessWeeks.weekEnd, date),
        ),
      )
      .limit(1)
    return week ?? null
  }
}
