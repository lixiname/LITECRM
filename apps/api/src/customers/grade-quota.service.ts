import { ConflictException, Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import type { CustomerGrade } from '../common/constants'
import type { DbClient } from '../common/db/db'
import {
  customerGradeQuotaDefaults,
  customers,
  userCustomerGradeQuotaOverrides,
  users,
} from '../common/db/schema'

/**
 * 客户分级名额：按「负责人 × 客户等级」分别计数。
 *
 * 所有新增占用都必须在业务事务内调用。先锁定负责人行，再读取名额和计数，
 * 可将同一负责人的并发建档、移交、认领、接管审批串行化，避免先查后写导致超额。
 */
@Injectable()
export class GradeQuotaService {
  async assertSlotAvailable(tx: DbClient, userId: string, grade: CustomerGrade): Promise<void> {
    const locked = await tx.execute(
      sql`select id from ${users} where ${users.id} = ${userId} for update`,
    )
    if (locked.rows.length === 0) throw new ConflictException('目标负责人不存在')

    const [override] = await tx
      .select({ limit: userCustomerGradeQuotaOverrides.limit })
      .from(userCustomerGradeQuotaOverrides)
      .where(
        and(
          eq(userCustomerGradeQuotaOverrides.userId, userId),
          eq(userCustomerGradeQuotaOverrides.grade, grade),
        ),
      )
      .limit(1)

    const [defaults] = await tx
      .select({ limit: customerGradeQuotaDefaults.defaultLimit })
      .from(customerGradeQuotaDefaults)
      .where(eq(customerGradeQuotaDefaults.grade, grade))
      .limit(1)

    // 有个人记录时其 null 表示明确不限；无个人记录才继承公司默认。
    const limit = override ? override.limit : (defaults?.limit ?? null)
    if (limit === null) return

    const [row] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(
        and(
          eq(customers.ownerId, userId),
          eq(customers.grade, grade),
          eq(customers.status, 'active'),
        ),
      )
    if (row.count >= limit) {
      throw new ConflictException(`该负责人 ${grade} 级客户名额已满（${limit}）`)
    }
  }
}
