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
import { complaints, opportunities } from './actions'
import { customers } from './customers'
import { users } from './org'

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

// 周计划只保存周目标/复盘摘要；行动明细按 owner + planned_at 动态查询。
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
    summary: text('summary'),
  },
  (table) => [
    uniqueIndex('weekly_plans_owner_week_uq').on(table.ownerId, table.businessWeekId),
    index('weekly_plans_owner_idx').on(table.ownerId),
  ],
)

// 未来行动唯一事实源。
export const followUpActions = pgTable(
  'follow_up_actions',
  {
    ...baseColumns,
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    customerId: uuid('customer_id').references(() => customers.id),
    opportunityId: uuid('opportunity_id').references(() => opportunities.id),
    complaintId: uuid('complaint_id').references(() => complaints.id),
    sourceType: text('source_type').notNull(),
    sourceId: uuid('source_id'),
    plannedAt: timestamp('planned_at', { withTimezone: true }).notNull(),
    content: text('content').notNull(),
    status: text('status').notNull().default('pending'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
  },
  (table) => [
    check(
      'follow_up_actions_source_type_check',
      sql`${table.sourceType} in ('manual','visit','opportunity','opportunity_follow_up','opportunity_quote','complaint','complaint_follow_up')`,
    ),
    check(
      'follow_up_actions_status_check',
      sql`${table.status} in ('pending','completed','cancelled')`,
    ),
    check(
      'follow_up_actions_lifecycle_check',
      sql`(${table.status} = 'pending' and ${table.completedAt} is null and ${table.cancelReason} is null)
        or (${table.status} = 'completed' and ${table.completedAt} is not null and ${table.cancelReason} is null)
        or (${table.status} = 'cancelled' and ${table.completedAt} is null and length(trim(${table.cancelReason})) > 0)`,
    ),
    check(
      'follow_up_actions_target_check',
      sql`${table.opportunityId} is null or ${table.customerId} is not null`,
    ),
    check(
      'follow_up_actions_complaint_target_check',
      sql`${table.complaintId} is null or ${table.customerId} is not null`,
    ),
    uniqueIndex('follow_up_actions_source_uq')
      .on(table.sourceType, table.sourceId)
      .where(sql`${table.sourceId} is not null`),
    index('follow_up_actions_owner_status_planned_idx').on(
      table.ownerId,
      table.status,
      table.plannedAt,
    ),
    index('follow_up_actions_opportunity_status_idx').on(table.opportunityId, table.status),
    index('follow_up_actions_complaint_status_idx').on(table.complaintId, table.status),
    index('follow_up_actions_customer_status_idx').on(table.customerId, table.status),
  ],
)

export const managementComments = pgTable(
  'management_comments',
  {
    ...baseColumns,
    targetType: text('target_type').notNull(),
    targetId: uuid('target_id').notNull(),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'comments_target_type_check',
      sql`${table.targetType} in ('weekly_plan','follow_up_action','visit')`,
    ),
    index('comments_owner_unread_idx').on(table.ownerId, table.readAt),
  ],
)

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
    status: text('status').notNull().default('draft'),
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
