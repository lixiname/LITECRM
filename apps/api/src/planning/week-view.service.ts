import { Injectable } from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../common/db/db'
import {
  complaints,
  opportunities,
  visitRecords,
  weeklyPlanItems,
  weeklyPlans,
} from '../common/db/schema'
import { AccessService } from '../access/access.service'
import type { AuthUser } from '../auth/auth.service'

export type WeekViewItemType = 'plan' | 'visit' | 'opportunity' | 'complaint'

export interface WeekViewItem {
  type: WeekViewItemType
  id: string
  summary: string
  customerId: string | null
  overdue: boolean
}

export interface DayBlock {
  date: string
  items: WeekViewItem[]
}

/**
 * 周览聚合（交互设计打磨 §2：个人日程记事本）
 * 按时间范围 + 数据范围（self/team/full）聚合四类：计划项 / 拜访 / 商机跟进 / 客诉跟进
 * 权限收口服务端（红线 6），前端只消费聚合结果
 */
@Injectable()
export class WeekViewService {
  constructor(private readonly accessService: AccessService) {}

  async getWeekView(user: AuthUser, start: string, end: string): Promise<DayBlock[]> {
    const visible = await this.accessService.getVisibleUserIds({
      id: user.id,
      role: user.role,
    })
    const today = new Date().toISOString().slice(0, 10)

    // ① 计划项（plannedDate 落范围）
    const plans = await db
      .select({
        id: weeklyPlanItems.id,
        date: weeklyPlanItems.plannedDate,
        action: weeklyPlanItems.action,
        customerId: weeklyPlanItems.customerId,
      })
      .from(weeklyPlanItems)
      .innerJoin(weeklyPlans, eq(weeklyPlanItems.planId, weeklyPlans.id))
      .where(
        and(
          inArray(weeklyPlans.ownerId, visible),
          sql`${weeklyPlanItems.plannedDate} between ${start} and ${end}`,
        ),
      )

    // ② 拜访（occurredAt 落范围，已发生）
    const visits = await db
      .select({
        id: visitRecords.id,
        date: sql<string>`${visitRecords.occurredAt}::date`,
        businessSituation: visitRecords.businessSituation,
        customerId: visitRecords.customerId,
      })
      .from(visitRecords)
      .where(
        and(
          inArray(visitRecords.ownerId, visible),
          sql`${visitRecords.occurredAt}::date between ${start} and ${end}`,
        ),
      )

    // ③ 商机跟进（在跟进 + nextFollowUpDate 落范围）
    const opps = await db
      .select({
        id: opportunities.id,
        date: opportunities.nextFollowUpDate,
        name: opportunities.name,
        customerId: opportunities.customerId,
      })
      .from(opportunities)
      .where(
        and(
          inArray(opportunities.ownerId, visible),
          sql`${opportunities.stage} not in ('lost','demand_disappeared')`,
          sql`${opportunities.nextFollowUpDate} is not null`,
          sql`${opportunities.nextFollowUpDate} between ${start} and ${end}`,
        ),
      )

    // ④ 客诉跟进（未解决 + nextFollowUpDate 落范围）
    const comps = await db
      .select({
        id: complaints.id,
        date: complaints.nextFollowUpDate,
        description: complaints.description,
        customerId: complaints.customerId,
      })
      .from(complaints)
      .where(
        and(
          inArray(complaints.ownerId, visible),
          eq(complaints.status, 'registered'),
          sql`${complaints.nextFollowUpDate} is not null`,
          sql`${complaints.nextFollowUpDate} between ${start} and ${end}`,
        ),
      )

    // 按天聚合
    const byDate = new Map<string, WeekViewItem[]>()
    for (const p of plans) {
      this.push(byDate, p.date, {
        type: 'plan',
        id: p.id,
        summary: p.action,
        customerId: p.customerId,
        overdue: false,
      })
    }
    for (const v of visits) {
      const date = String(v.date).slice(0, 10)
      this.push(byDate, date, {
        type: 'visit',
        id: v.id,
        summary: v.businessSituation ?? '拜访',
        customerId: v.customerId,
        overdue: false,
      })
    }
    for (const o of opps) {
      const date = String(o.date).slice(0, 10)
      this.push(byDate, date, {
        type: 'opportunity',
        id: o.id,
        summary: o.name,
        customerId: o.customerId,
        overdue: date < today,
      })
    }
    for (const c of comps) {
      const date = String(c.date).slice(0, 10)
      this.push(byDate, date, {
        type: 'complaint',
        id: c.id,
        summary: c.description.slice(0, 30),
        customerId: c.customerId,
        overdue: date < today,
      })
    }

    // 生成 start~end 每一天（含空天，日期排序）
    const days: DayBlock[] = []
    const cursor = new Date(`${start}T00:00:00`)
    const last = new Date(`${end}T00:00:00`)
    while (cursor <= last) {
      const key = this.fmt(cursor)
      days.push({ date: key, items: byDate.get(key) ?? [] })
      cursor.setDate(cursor.getDate() + 1)
    }
    return days
  }

  private push(map: Map<string, WeekViewItem[]>, date: string, item: WeekViewItem): void {
    const list = map.get(date) ?? []
    list.push(item)
    map.set(date, list)
  }

  private fmt(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
}
