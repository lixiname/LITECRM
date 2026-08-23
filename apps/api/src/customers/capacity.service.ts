import { ConflictException, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '../common/db/db'
import { capacityConfig, customers, userCapacityOverrides } from '../common/db/schema'
import type { CustomerLevel } from '../common/constants'

/**
 * 分级容量（§7.2/§8.3）：owner 名下 active 客户数受等级上限约束。
 * 等级来源：user_capacity_overrides.level（个人覆盖）；无覆盖默认 C。
 * 上限来源：override.limit ?? capacity_config(level).default_limit；null = 不限。
 * 触发点：建档指定负责人 / 移交 / 公海认领 / 接管审批。
 */
@Injectable()
export class CapacityService {
  // 用户当前容量等级（个人覆盖或默认 C）
  async getUserLevel(userId: string): Promise<CustomerLevel> {
    const [ov] = await db
      .select({ level: userCapacityOverrides.level })
      .from(userCapacityOverrides)
      .where(eq(userCapacityOverrides.userId, userId))
      .limit(1)
    return (ov?.level ?? 'C') as CustomerLevel
  }

  // 用户上限（null = 不限）
  async getLimit(userId: string): Promise<number | null> {
    const [ov] = await db
      .select({ level: userCapacityOverrides.level, limit: userCapacityOverrides.limit })
      .from(userCapacityOverrides)
      .where(eq(userCapacityOverrides.userId, userId))
      .limit(1)
    const level = ov?.level ?? 'C'
    const [cfg] = await db
      .select({ defaultLimit: capacityConfig.defaultLimit })
      .from(capacityConfig)
      .where(eq(capacityConfig.level, level))
      .limit(1)
    return ov?.limit ?? cfg?.defaultLimit ?? null
  }

  // 校验：当前名下 active 客户数 < 上限；超限抛 409（§8.3 容量校验）
  async assertWithinCapacity(userId: string): Promise<void> {
    const limit = await this.getLimit(userId)
    if (limit === null) return

    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(eq(customers.ownerId, userId), eq(customers.status, 'active')))
    if (row.count >= limit) {
      throw new ConflictException(`该负责人客户容量已达上限（${limit}）`)
    }
  }
}
