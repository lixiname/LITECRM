import { sql } from 'drizzle-orm'
import { db, type DbClient } from '../common/db/db'
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

export interface CustomerActivityProjectionDrift {
  customerId: string
  currentFirstVisitedAt: string | null
  expectedFirstVisitedAt: string | null
  currentFirstDealAt: string | null
  expectedFirstDealAt: string | null
  currentLastActivityAt: string | null
  expectedLastActivityAt: string | null
}

/**
 * 从不可变业务事实计算客户活动投影。这里只读取事实表，不依赖 customers 上的当前派生值。
 * SQL 同时服务于“只检查”和“执行修复”，避免两套口径逐渐漂移。
 */
const customerActivityProjectionCte = sql`
  WITH activity_facts AS (
    SELECT customer_id, occurred_at, 'visit'::text AS kind FROM visit_records
    UNION ALL
    SELECT customer_id, discovered_date, 'activity'::text FROM opportunities WHERE discovered_date IS NOT NULL
    UNION ALL
    SELECT customer_id, occurred_at, 'activity'::text FROM opportunity_events
    UNION ALL
    SELECT o.customer_id, f.occurred_at, 'activity'::text
      FROM opportunity_follow_ups f JOIN opportunities o ON o.id = f.opportunity_id
    UNION ALL
    SELECT o.customer_id, q.quoted_at, 'activity'::text
      FROM opportunity_quotes q JOIN opportunities o ON o.id = q.opportunity_id
    UNION ALL
    SELECT customer_id, occurred_at, 'deal'::text FROM deals
    UNION ALL
    SELECT customer_id, occurred_at, 'activity'::text FROM complaints
    UNION ALL
    SELECT c.customer_id, f.occurred_at, 'activity'::text
      FROM complaint_follow_ups f JOIN complaints c ON c.id = f.complaint_id
  ), expected AS (
    SELECT
      c.id AS customer_id,
      min(f.occurred_at) FILTER (WHERE f.kind = 'visit')::text AS first_visited_at,
      min(f.occurred_at) FILTER (WHERE f.kind = 'deal')::text AS first_deal_at,
      max(f.occurred_at)::text AS last_activity_at
    FROM customers c
    LEFT JOIN activity_facts f ON f.customer_id = c.id
    GROUP BY c.id
  )
`

export async function findCustomerActivityProjectionDrift(
  client: Pick<typeof db, 'execute'> = db,
): Promise<CustomerActivityProjectionDrift[]> {
  const result = await client.execute(sql`
    ${customerActivityProjectionCte}
    SELECT
      c.id AS "customerId",
      c.first_visited_at::text AS "currentFirstVisitedAt",
      e.first_visited_at AS "expectedFirstVisitedAt",
      c.first_deal_at::text AS "currentFirstDealAt",
      e.first_deal_at AS "expectedFirstDealAt",
      c.last_activity_at::text AS "currentLastActivityAt",
      e.last_activity_at AS "expectedLastActivityAt"
    FROM customers c
    JOIN expected e ON e.customer_id = c.id
    WHERE c.first_visited_at::text IS DISTINCT FROM e.first_visited_at
       OR c.first_deal_at::text IS DISTINCT FROM e.first_deal_at
       OR c.last_activity_at::text IS DISTINCT FROM e.last_activity_at
    ORDER BY c.id
  `)
  return result.rows as unknown as CustomerActivityProjectionDrift[]
}

export async function rebuildCustomerActivityProjections(
  client: Pick<typeof db, 'execute'> = db,
): Promise<number> {
  const result = await client.execute(sql`
    ${customerActivityProjectionCte}
    UPDATE customers c
    SET
      first_visited_at = e.first_visited_at::date,
      first_deal_at = e.first_deal_at::date,
      last_activity_at = e.last_activity_at::date,
      updated_at = CASE
        WHEN c.first_visited_at::text IS DISTINCT FROM e.first_visited_at
          OR c.first_deal_at::text IS DISTINCT FROM e.first_deal_at
          OR c.last_activity_at::text IS DISTINCT FROM e.last_activity_at
        THEN now()
        ELSE c.updated_at
      END,
      version = CASE
        WHEN c.first_visited_at::text IS DISTINCT FROM e.first_visited_at
          OR c.first_deal_at::text IS DISTINCT FROM e.first_deal_at
          OR c.last_activity_at::text IS DISTINCT FROM e.last_activity_at
        THEN c.version + 1
        ELSE c.version
      END
    FROM expected e
    WHERE c.id = e.customer_id
      AND (
        c.first_visited_at::text IS DISTINCT FROM e.first_visited_at
        OR c.first_deal_at::text IS DISTINCT FROM e.first_deal_at
        OR c.last_activity_at::text IS DISTINCT FROM e.last_activity_at
      )
    RETURNING c.id
  `)
  return result.rowCount ?? result.rows.length
}
