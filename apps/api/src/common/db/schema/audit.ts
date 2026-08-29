import { jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { baseColumns } from './common'
import { users } from './org'

/**
 * 审计日志（规格 §8.10）：append-only，不可改不可删，用于业务回溯（红线 14）
 */
export const auditLogs = pgTable('audit_logs', {
  ...baseColumns,
  actorId: uuid('actor_id').references(() => users.id), // 可空：系统动作无操作人
  action: text('action').notNull(), // 如 user.create / auth.login
  entityType: text('entity_type').notNull(), // 多态弱引用（规格 §7.2 约定②）
  // 多态审计对象可能使用 UUID、自然键或复合键；统一存文本，避免伪造 UUID。
  entityId: text('entity_id').notNull(),
  before: jsonb('before'), // 变更前快照
  after: jsonb('after'), // 变更后快照
})
