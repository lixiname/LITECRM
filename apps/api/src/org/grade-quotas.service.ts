import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { CUSTOMER_GRADES, type CustomerGrade, type Role } from '../common/constants'
import { db } from '../common/db/db'
import {
  auditLogs,
  customerGradeQuotaDefaults,
  customers,
  userCustomerGradeQuotaOverrides,
  users,
} from '../common/db/schema'
import type {
  CustomerGradeQuotaMode,
  GradeQuotaOverviewDto,
  UpdateGradeQuotaDefaultsDto,
  UpdateUserGradeQuotasDto,
} from './dto/grade-quota.dto'

type OverrideRow = typeof userCustomerGradeQuotaOverrides.$inferSelect

@Injectable()
export class GradeQuotasService {
  async getOverview(): Promise<GradeQuotaOverviewDto> {
    const [defaultRows, assignees, overrideRows, usageRows] = await Promise.all([
      db.select().from(customerGradeQuotaDefaults),
      db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          role: users.role,
          region: users.region,
          isActive: users.isActive,
        })
        .from(users)
        .where(inArray(users.role, ['sales', 'executive']))
        .orderBy(desc(users.isActive), asc(users.region), asc(users.displayName)),
      db.select().from(userCustomerGradeQuotaOverrides),
      db
        .select({
          userId: customers.ownerId,
          grade: customers.grade,
          used: count(customers.id),
        })
        .from(customers)
        .where(eq(customers.status, 'active'))
        .groupBy(customers.ownerId, customers.grade),
    ])

    const defaultByGrade = new Map(defaultRows.map((row) => [row.grade, row.defaultLimit]))
    const overrideByUserGrade = new Map(
      overrideRows.map((row) => [quotaKey(row.userId, row.grade), row]),
    )
    const usageByUserGrade = new Map(
      usageRows
        .filter((row): row is typeof row & { userId: string } => Boolean(row.userId))
        .map((row) => [quotaKey(row.userId, row.grade), Number(row.used)]),
    )

    const defaults = CUSTOMER_GRADES.map((grade) => ({
      grade,
      limit: defaultByGrade.get(grade) ?? null,
    }))

    return {
      defaults,
      users: assignees.map((user) => ({
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role as Role,
        region: user.region,
        isActive: user.isActive,
        quotas: CUSTOMER_GRADES.map((grade) => {
          const override = overrideByUserGrade.get(quotaKey(user.id, grade))
          const mode = getOverrideMode(override)
          const used = usageByUserGrade.get(quotaKey(user.id, grade)) ?? 0
          const effectiveLimit = override ? override.limit : (defaultByGrade.get(grade) ?? null)
          return {
            grade,
            used,
            mode,
            overrideLimit: mode === 'limited' ? (override?.limit ?? null) : null,
            effectiveLimit,
            remaining: effectiveLimit === null ? null : Math.max(effectiveLimit - used, 0),
            exceeded: effectiveLimit !== null && used > effectiveLimit,
            atCapacity: effectiveLimit !== null && used >= effectiveLimit,
          }
        }),
      })),
    }
  }

  async updateDefaults(dto: UpdateGradeQuotaDefaultsDto, actorId: string) {
    assertCompleteGrades(dto.items)
    const before = await this.getOverview()

    await db.transaction(async (tx) => {
      for (const item of dto.items) {
        await tx
          .insert(customerGradeQuotaDefaults)
          .values({ grade: item.grade, defaultLimit: item.limit })
          .onConflictDoUpdate({
            target: customerGradeQuotaDefaults.grade,
            set: {
              defaultLimit: item.limit,
              updatedAt: new Date(),
              version: sql`${customerGradeQuotaDefaults.version} + 1`,
            },
          })
      }
      await tx.insert(auditLogs).values({
        actorId,
        action: 'customer_grade_quota_defaults.updated',
        entityType: 'customer_grade_quota_defaults',
        entityId: 'company',
        before: before.defaults,
        after: dto.items,
      })
    })

    return this.getOverview()
  }

  async updateUser(userId: string, dto: UpdateUserGradeQuotasDto, actorId: string) {
    assertCompleteGrades(dto.items)
    const [target] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    if (!target) throw new NotFoundException('用户不存在')
    if (target.role !== 'sales' && target.role !== 'executive') {
      throw new BadRequestException('只有销售人员和销售经理可配置客户分级名额')
    }

    const before = await db
      .select()
      .from(userCustomerGradeQuotaOverrides)
      .where(eq(userCustomerGradeQuotaOverrides.userId, userId))

    await db.transaction(async (tx) => {
      for (const item of dto.items) {
        if (item.mode === 'inherit') {
          await tx
            .delete(userCustomerGradeQuotaOverrides)
            .where(
              and(
                eq(userCustomerGradeQuotaOverrides.userId, userId),
                eq(userCustomerGradeQuotaOverrides.grade, item.grade),
              ),
            )
          continue
        }

        const limit = item.mode === 'unlimited' ? null : item.limit
        if (item.mode === 'limited' && limit === undefined) {
          throw new BadRequestException(`${item.grade} 级自定义名额不能为空`)
        }
        await tx
          .insert(userCustomerGradeQuotaOverrides)
          .values({ userId, grade: item.grade, limit: limit ?? null })
          .onConflictDoUpdate({
            target: [userCustomerGradeQuotaOverrides.userId, userCustomerGradeQuotaOverrides.grade],
            set: {
              limit: limit ?? null,
              updatedAt: new Date(),
              version: sql`${userCustomerGradeQuotaOverrides.version} + 1`,
            },
          })
      }
      await tx.insert(auditLogs).values({
        actorId,
        action: 'user_customer_grade_quotas.updated',
        entityType: 'user_customer_grade_quotas',
        entityId: userId,
        before,
        after: dto.items,
      })
    })

    return this.getOverview()
  }
}

function assertCompleteGrades(items: Array<{ grade: CustomerGrade }>) {
  const grades = new Set(items.map((item) => item.grade))
  if (
    grades.size !== CUSTOMER_GRADES.length ||
    CUSTOMER_GRADES.some((grade) => !grades.has(grade))
  ) {
    throw new BadRequestException('必须且只能提交 S/A/B/C 四个客户等级')
  }
}

function quotaKey(userId: string, grade: CustomerGrade) {
  return `${userId}:${grade}`
}

function getOverrideMode(override: OverrideRow | undefined): CustomerGradeQuotaMode {
  if (!override) return 'inherit'
  return override.limit === null ? 'unlimited' : 'limited'
}
