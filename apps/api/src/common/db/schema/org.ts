import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './common'
import { salesRegions } from './geography'
import type { CustomerGrade } from '../../constants'

/**
 * 组织与身份域（规格 §7.2 org）
 * 注意：角色枚举用 varchar + CHECK（规格 §7.1：不用 PG enum，避免 ALTER TYPE 迁移坑）
 */

// 用户：登录身份 + 组织树节点 + 数据属性
export const users = pgTable(
  'users',
  {
    ...baseColumns,
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    phone: text('phone'), // 钉钉绑定预留（§9.1）
    passwordHash: text('password_hash').notNull(),
    tokenVersion: integer('token_version').default(0).notNull(), // 改密/停用使 token 失效（§6.5）
    loginFailedCount: integer('login_failed_count').default(0).notNull(), // 防爆破
    lockedUntil: timestamp('locked_until', { withTimezone: true }), // 锁定截止（null=未锁）
    role: text('role').notNull(), // sales/executive/assistant/admin
    reportsToId: uuid('reports_to_id'), // 汇报树单源（§6.1），外键在 extra config 定义（自引用）
    salesRegionId: uuid('sales_region_id').references(() => salesRegions.id), // 人员所属管理大区，只用于统计分组，不进权限模型
    isActive: boolean('is_active').default(true).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_username_uq').on(table.username),
    check('users_role_check', sql`${table.role} in ('sales','executive','assistant','admin')`),
    // 自引用外键：汇报树（引用 users 自身，须放 extra config 避免 TS 循环推断）
    foreignKey({
      columns: [table.reportsToId],
      foreignColumns: [table.id],
    }),
  ],
)

// 客户分级名额：公司默认值。grade 即主键，故不用 baseColumns 的 id。
export const customerGradeQuotaDefaults = pgTable(
  'customer_grade_quota_defaults',
  {
    grade: text('customer_grade').$type<CustomerGrade>().primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    version: integer('version').default(1).notNull(),
    defaultLimit: integer('default_limit'), // null=不限
  },
  (table) => [
    check('customer_grade_quota_defaults_grade_check', sql`${table.grade} in ('S','A','B','C')`),
    check(
      'customer_grade_quota_defaults_limit_check',
      sql`${table.defaultLimit} is null or ${table.defaultLimit} >= 0`,
    ),
  ],
)

// 客户分级名额：负责人个人覆盖；没有记录时继承公司默认值，limit=null 表示明确不限。
export const userCustomerGradeQuotaOverrides = pgTable(
  'user_customer_grade_quota_overrides',
  {
    ...baseColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    grade: text('customer_grade').$type<CustomerGrade>().notNull(),
    limit: integer('limit'),
  },
  (table) => [
    check(
      'user_customer_grade_quota_overrides_grade_check',
      sql`${table.grade} in ('S','A','B','C')`,
    ),
    check(
      'user_customer_grade_quota_overrides_limit_check',
      sql`${table.limit} is null or ${table.limit} >= 0`,
    ),
    uniqueIndex('user_customer_grade_quota_overrides_user_grade_uq').on(table.userId, table.grade),
  ],
)
