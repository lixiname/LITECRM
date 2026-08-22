import { integer, timestamp, uuid } from 'drizzle-orm/pg-core'

// 所有表统一基础字段（规格 §7.1）：id + createdAt + updatedAt + version（乐观锁）
export const baseColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  version: integer('version').default(1).notNull(), // 乐观锁版本号：应用层 update where version = N
}
