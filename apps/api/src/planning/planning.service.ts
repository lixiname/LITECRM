import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { db, type DbClient } from '../common/db/db'
import {
  businessWeeks,
  managementComments,
  weeklyPlanItems,
  weeklyPlans,
} from '../common/db/schema'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'
import type { CreateBusinessWeekDto } from './dto/create-business-week.dto'
import type { CreatePlanItemDto } from './dto/create-plan-item.dto'
import type { CreateCommentDto } from './dto/create-comment.dto'

/**
 * 周计划（§8.7）：业务周（admin 配置 + 日期自动兜底自然周）→ 周计划（owner+week 唯一）→ 计划项。
 * 拜访联动：ensurePlanForWeek + 插入计划项（同事务，供 VisitsService 调用）。
 * 指导意见：author 须为被指导者上级（管理链）；read_at 已读闭环。
 */
@Injectable()
export class PlanningService {
  constructor(private readonly accessService: AccessService) {}

  // ===== 业务周 =====

  async createBusinessWeek(dto: CreateBusinessWeekDto) {
    const [week] = await db
      .insert(businessWeeks)
      .values({
        name: dto.name,
        weekStart: dto.weekStart,
        weekEnd: dto.weekEnd,
        isActive: dto.isActive ?? true,
      })
      .onConflictDoNothing()
      .returning()
    if (!week) throw new ConflictException('该周起始日已存在业务周')
    return week
  }

  async listBusinessWeeks() {
    return db.select().from(businessWeeks).orderBy(desc(businessWeeks.weekStart))
  }

  // 定位日期所在业务周：存在则复用；不存在则自动创建自然周（周一~周日）——保证拜访联动可用
  async ensureBusinessWeekForDate(date: string, tx: DbClient | typeof db = db) {
    const [week] = await tx
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
    if (week) return week

    const [start, end] = weekRange(date)
    const [created] = await tx
      .insert(businessWeeks)
      .values({ name: `业务周 ${start}`, weekStart: start, weekEnd: end })
      .onConflictDoNothing()
      .returning()
    if (created) return created
    const [again] = await tx
      .select()
      .from(businessWeeks)
      .where(eq(businessWeeks.weekStart, start))
      .limit(1)
    return again!
  }

  // 定位/创建某用户某周计划（§8.7：owner + business_week 唯一）
  async ensurePlanForWeek(
    ownerId: string,
    date: string,
    tx: DbClient | typeof db = db,
  ): Promise<string> {
    const week = await this.ensureBusinessWeekForDate(date, tx)
    const [plan] = await tx
      .insert(weeklyPlans)
      .values({ ownerId, businessWeekId: week.id })
      .onConflictDoNothing()
      .returning({ id: weeklyPlans.id })
    if (plan) return plan.id
    const [existing] = await tx
      .select({ id: weeklyPlans.id })
      .from(weeklyPlans)
      .where(and(eq(weeklyPlans.ownerId, ownerId), eq(weeklyPlans.businessWeekId, week.id)))
      .limit(1)
    return existing!.id
  }

  // 拜访联动：往某周计划插入计划项（同事务）
  async addLinkedPlanItem(
    tx: DbClient,
    ownerId: string,
    plannedDate: string,
    customerId: string,
    action: string,
  ): Promise<void> {
    const planId = await this.ensurePlanForWeek(ownerId, plannedDate, tx)
    await tx.insert(weeklyPlanItems).values({ planId, plannedDate, customerId, action })
  }

  // ===== 周计划项（本人）=====

  // 我的周计划（§8.7：owner + business_week）
  async getMyPlan(businessWeekId: string, actor: AuthUser) {
    const [plan] = await db
      .select()
      .from(weeklyPlans)
      .where(and(eq(weeklyPlans.ownerId, actor.id), eq(weeklyPlans.businessWeekId, businessWeekId)))
      .limit(1)
    if (!plan) return null
    const items = await db
      .select()
      .from(weeklyPlanItems)
      .where(eq(weeklyPlanItems.planId, plan.id))
      .orderBy(weeklyPlanItems.plannedDate)
    return { ...plan, items }
  }

  // 加计划项（§8.7：plannedDate 在业务周内；action 必填）
  async addPlanItem(planId: string, dto: CreatePlanItemDto, actor: AuthUser) {
    const [plan] = await db.select().from(weeklyPlans).where(eq(weeklyPlans.id, planId)).limit(1)
    if (!plan || plan.ownerId !== actor.id) throw new ForbiddenException('仅本人周计划可添加')
    const [week] = await db
      .select()
      .from(businessWeeks)
      .where(eq(businessWeeks.id, plan.businessWeekId))
      .limit(1)
    if (week && (dto.plannedDate < week.weekStart || dto.plannedDate > week.weekEnd)) {
      throw new ConflictException('计划日期需在业务周内')
    }
    const [item] = await db
      .insert(weeklyPlanItems)
      .values({
        planId,
        plannedDate: dto.plannedDate,
        customerId: dto.customerId ?? null,
        action: dto.action,
        notes: dto.notes ?? null,
      })
      .returning()
    return item
  }

  // ===== 指导意见（§8.7）=====

  // 发布意见：author 须为被指导者上级（管理链）
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

  // 我的未读意见（红点闭环）
  async listUnreadComments(actor: AuthUser) {
    return db
      .select()
      .from(managementComments)
      .where(
        and(eq(managementComments.ownerId, actor.id), sql`${managementComments.readAt} IS NULL`),
      )
      .orderBy(desc(managementComments.createdAt))
  }

  // 标记已读
  async markCommentRead(id: string, actor: AuthUser) {
    const [comment] = await db
      .select()
      .from(managementComments)
      .where(eq(managementComments.id, id))
      .limit(1)
    if (!comment || comment.ownerId !== actor.id) throw new NotFoundException('意见不存在')
    await db
      .update(managementComments)
      .set({ readAt: new Date() })
      .where(eq(managementComments.id, id))
  }
}

// 自然周范围（周一~周日，UTC 一致）
function weekRange(dateStr: string): [string, string] {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const day = d.getUTCDay() // 0=周日
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() + diff)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return [monday.toISOString().slice(0, 10), sunday.toISOString().slice(0, 10)]
}
