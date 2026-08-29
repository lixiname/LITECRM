import { sql } from 'drizzle-orm'
import type { DbClient } from '../common/db/db'
import { customers } from '../common/db/schema'

type ActivityKind = 'activity' | 'visit' | 'deal'

/**
 * 维护客户列表使用的活动投影。
 * 业务事实仍保存在拜访、跟进、报价、客诉和成交表；这里仅维护可重建的派生时间。
 */
export async function touchCustomerActivity(
  tx: DbClient,
  customerId: string,
  occurredAt: string,
  kind: ActivityKind = 'activity',
): Promise<void> {
  const firstVisitedAt =
    kind === 'visit'
      ? sql`least(coalesce(${customers.firstVisitedAt}, ${occurredAt}), ${occurredAt})`
      : undefined
  const firstDealAt =
    kind === 'deal'
      ? sql`least(coalesce(${customers.firstDealAt}, ${occurredAt}), ${occurredAt})`
      : undefined

  await tx
    .update(customers)
    .set({
      lastActivityAt: sql`greatest(coalesce(${customers.lastActivityAt}, ${occurredAt}), ${occurredAt})`,
      ...(firstVisitedAt ? { firstVisitedAt } : {}),
      ...(firstDealAt ? { firstDealAt } : {}),
    })
    .where(sql`${customers.id} = ${customerId}`)
}
