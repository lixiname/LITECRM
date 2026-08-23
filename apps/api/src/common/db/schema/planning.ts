import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './common'
import { customers } from './customers'
import { users } from './org'
import { visitRecords } from './actions'

/**
 * 计划费用域（规格 §7.2 04）：
 * business_weeks（业务周）/ weekly_plans + weekly_plan_items（周计划）/
 * management_comments（指导意见，多态）/ daily_expenses（费用，轻量统计非报销）
 */

// 业务周（§8.7：13 周窗口 company-wide，管理员配置；week_start 唯一）
export const businessWeeks = pgTable(
  'business_weeks',
  {
    ...baseColumns,
    name: text('name').notNull(),
    weekStart: date('week_start').notNull(),
    weekEnd: date('week_end').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [uniqueIndex('business_weeks_start_uq').on(table.weekStart)],
)

// 周计划（§8.7：owner + business_week 唯一）
export const weeklyPlans = pgTable(
  'weekly_plans',
  {
    ...baseColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    businessWeekId: uuid('business_week_id')
      .notNull()
      .references(() => businessWeeks.id),
    notes: text('notes'),
  },
  (table) => [
    uniqueIndex('weekly_plans_owner_week_uq').on(table.ownerId, table.businessWeekId),
    index('weekly_plans_owner_idx').on(table.ownerId),
  ],
)

// 周计划项（§8.7：plannedDate 在业务周内；customerId 可空；action 必填；拜访联动自动生成）
export const weeklyPlanItems = pgTable(
  'weekly_plan_items',
  {
    ...baseColumns,
    planId: uuid('plan_id')
      .notNull()
      .references(() => weeklyPlans.id),
    plannedDate: date('planned_date').notNull(),
    customerId: uuid('customer_id').references(() => customers.id), // 可空：同行关系维护
    action: text('action').notNull(), // 行动计划
    notes: text('notes'),
  },
  (table) => [index('plan_items_plan_idx').on(table.planId)],
)

// 指导意见（§8.7：author 须为被指导者上级；read_at 已读闭环；红点）
export const managementComments = pgTable(
  'management_comments',
  {
    ...baseColumns,
    targetType: text('target_type').notNull(), // weekly_plan/weekly_plan_item/visit
    targetId: uuid('target_id').notNull(), // 多态弱引用
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id), // 被指导人
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id), // 指导人（上级）
    content: text('content').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }), // 已读
  },
  (table) => [
    check(
      'comments_target_type_check',
      sql`${table.targetType} in ('weekly_plan','weekly_plan_item','visit')`,
    ),
    index('comments_owner_unread_idx').on(table.ownerId, table.readAt),
  ],
)

// 每日费用（§8.8：每人每天一条 upsert；五类分项；三态）
export const dailyExpenses = pgTable(
  'daily_expenses',
  {
    ...baseColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    expenseDate: date('expense_date').notNull(),
    tobaccoAlcohol: numeric('tobacco_alcohol', { precision: 12, scale: 2 }).default('0').notNull(),
    gifts: numeric('gifts', { precision: 12, scale: 2 }).default('0').notNull(),
    dining: numeric('dining', { precision: 12, scale: 2 }).default('0').notNull(),
    entertainment: numeric('entertainment', { precision: 12, scale: 2 }).default('0').notNull(),
    lodging: numeric('lodging', { precision: 12, scale: 2 }).default('0').notNull(),
    notes: text('notes'),
    status: text('status').notNull().default('draft'), // draft/submitted/voided
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    uniqueIndex('daily_expenses_owner_date_uq').on(table.ownerId, table.expenseDate),
    check('daily_expenses_status_check', sql`${table.status} in ('draft','submitted','voided')`),
    index('daily_expenses_owner_date_idx').on(table.ownerId, table.expenseDate),
  ],
)
