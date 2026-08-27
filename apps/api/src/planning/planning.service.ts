import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import { db } from '../common/db/db'
import {
  businessWeeks,
  followUpActions,
  managementComments,
  weeklyPlans,
} from '../common/db/schema'
import { SalesPlansService } from '../follow-up-actions/follow-up-actions.service'
import type { CreateBusinessWeekDto } from './dto/create-business-week.dto'
import type { CreateCommentDto } from './dto/create-comment.dto'
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

  async createComment(dto: CreateCommentDto, actor: AuthUser) {
    if (dto.ownerId === actor.id) throw new ForbiddenException('不能给自己留言')
    const isManager = await this.accessService.isManagerOf(actor.id, dto.ownerId)
    if (!isManager && actor.role !== 'admin') throw new ForbiddenException('仅上级可发布指导意见')
    const [comment] = await db
      .insert(managementComments)
      .values({
        targetType: dto.targetType,
        targetId: dto.targetId,
        ownerId: dto.ownerId,
        authorId: actor.id,
        content: dto.content,
      })
      .returning()
    return comment
  }

  async listUnreadComments(actor: AuthUser) {
    return db
      .select()
      .from(managementComments)
      .where(
        and(eq(managementComments.ownerId, actor.id), sql`${managementComments.readAt} is null`),
      )
      .orderBy(desc(managementComments.createdAt))
  }

  async markCommentRead(id: string, actor: AuthUser) {
    const [updated] = await db
      .update(managementComments)
      .set({
        readAt: new Date(),
        updatedAt: new Date(),
        version: sql`${managementComments.version} + 1`,
      })
      .where(and(eq(managementComments.id, id), eq(managementComments.ownerId, actor.id)))
      .returning()
    if (!updated) throw new NotFoundException('意见不存在')
    return updated
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
