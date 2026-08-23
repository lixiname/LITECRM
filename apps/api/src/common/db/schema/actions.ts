import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './common'
import { customers } from './customers'
import { users } from './org'

/**
 * 业务动作域（规格 §7.2 02/03）：
 * visit_records（拜访）/ opportunities + opportunity_events + deals（商机闭环）/
 * complaints + complaint_follow_ups（客诉闭环）
 * 归属快照语义：owner_id = 创建时归属快照（不可变）；当前归属一律 JOIN 客户推导（§7.2 设计约定）
 * 金额分层：opportunities.amount=意向金额（可更新） / deals.amount=成交金额（下单时最终值，独立快照）
 */

// 拜访登记（§8.4 P0 主场景）：必填 customerId/occurredAt/method；填 nextFollowUpDate → 强一致生成周计划项（M4 接入）
export const visitRecords = pgTable(
  'visit_records',
  {
    ...baseColumns,
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id), // 创建时归属快照（填报人）
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(), // 沟通时间（业务时间）
    method: text('method').notNull(), // offline_visit/remote/other
    visitType: text('visit_type'), // new_customer/existing_maintenance/industry_relation
    businessSituation: text('business_situation'), // 生意情况
    equipmentSituation: text('equipment_situation'), // 设备使用
    personnelChanges: text('personnel_changes'), // 人员变动
    nextFollowUpDate: date('next_follow_up_date'), // 触发周计划生成
    nextFollowUpAction: text('next_follow_up_action'),
    entrySource: text('entry_source'), // AI 录入来源（§7.1 预留）
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    check('visits_method_check', sql`${table.method} in ('offline_visit','remote','other')`),
    check(
      'visits_type_check',
      sql`${table.visitType} in ('new_customer','existing_maintenance','industry_relation')`,
    ),
    index('visits_customer_idx').on(table.customerId),
    index('visits_owner_occurred_idx').on(table.ownerId, table.occurredAt),
  ],
)

// 商机（§8.5 状态机：intent→following→ordered→lost/demand_disappeared）
export const opportunities = pgTable(
  'opportunities',
  {
    ...baseColumns,
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id), // 创建时归属快照
    name: text('name').notNull(), // 需求简述
    stage: text('stage').notNull().default('intent'),
    source: text('source').notNull(), // 发现渠道
    productLine: text('product_line'), // 大类产品线（字典可选）
    sourceRecordId: uuid('source_record_id').references(() => visitRecords.id), // 来源拜访
    amountType: text('amount_type').notNull().default('oral'), // oral/quoted（意向金额精度分层）
    amount: numeric('amount', { precision: 14, scale: 2 }), // 意向金额
    approximate: boolean('approximate').default(false).notNull(), // 约估
    amountNote: text('amount_note'), // 金额表述
    discoveredDate: date('discovered_date'), // 需求发现日
    expectedCloseDate: date('expected_close_date'), // 预计成交日
    lastFollowUpAt: timestamp('last_follow_up_at', { withTimezone: true }),
    nextAction: text('next_action'), // 下一步动作
    nextFollowUpDate: date('next_follow_up_date'),
    closedAt: timestamp('closed_at', { withTimezone: true }), // 结案时间
    closeReason: text('close_reason'), // 结案说明
    notes: text('notes'),
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    check(
      'opportunities_stage_check',
      sql`${table.stage} in ('intent','following','ordered','lost','demand_disappeared')`,
    ),
    check('opportunities_amount_type_check', sql`${table.amountType} in ('oral','quoted')`),
    check(
      'opportunities_source_check',
      sql`${table.source} in ('referral','cold_call','exhibition','online','other')`,
    ),
    index('opportunities_customer_idx').on(table.customerId),
    index('opportunities_owner_stage_idx').on(table.ownerId, table.stage),
    index('opportunities_followup_idx').on(table.nextFollowUpDate),
  ],
)

// 商机事件流（§8.5：只追加，业务时间，金额变化等以 payload 快照记录）
export const opportunityEvents = pgTable(
  'opportunity_events',
  {
    ...baseColumns,
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    customerId: uuid('customer_id').notNull(), // 冗余（JOIN 客户用）
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(), // 业务时间
    type: text('type').notNull(), // created/stage_changed/updated
    payload: jsonb('payload'), // 事件快照（含 before/after）
  },
  (table) => [
    check(
      'opportunity_events_type_check',
      sql`${table.type} in ('created','stage_changed','updated')`,
    ),
    index('opportunity_events_opp_occurred_idx').on(table.opportunityId, table.occurredAt),
  ],
)

// 成交 Deal（§8.5：转订单生成，金额=下单时最终值，与意向金额解耦）
export const deals = pgTable(
  'deals',
  {
    ...baseColumns,
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(), // 成交时间
    amount: numeric('amount', { precision: 14, scale: 2 }), // 成交金额
    productLine: text('product_line'), // 成交产品线
    tradeType: text('trade_type'), // equipment/consumable/part/service
    note: text('note'),
    sourceOpportunityId: uuid('source_opportunity_id').references(() => opportunities.id), // 转成交指回
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    check(
      'deals_trade_type_check',
      sql`${table.tradeType} in ('equipment','consumable','part','service')`,
    ),
    index('deals_customer_idx').on(table.customerId),
  ],
)

// 客诉（§8.6：两态 registered→resolved，进度靠跟进事件）
export const complaints = pgTable(
  'complaints',
  {
    ...baseColumns,
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id), // 创建时归属快照
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(), // 发生时间
    type: text('type').notNull(), // 6 类字典
    status: text('status').notNull().default('registered'),
    description: text('description').notNull(), // 问题描述
    nextFollowUpDate: date('next_follow_up_date'),
    resolution: text('resolution'), // 解决结果
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    check(
      'complaints_type_check',
      sql`${table.type} in ('product_quality','delivery','service','logistics','price','other')`,
    ),
    check('complaints_status_check', sql`${table.status} in ('registered','resolved')`),
    index('complaints_customer_idx').on(table.customerId),
    index('complaints_status_followup_idx').on(table.status, table.nextFollowUpDate),
  ],
)

// 客诉跟进（§8.6：只追加；outcome=resolved 时主记录迁移终态）
export const complaintFollowUps = pgTable(
  'complaint_follow_ups',
  {
    ...baseColumns,
    complaintId: uuid('complaint_id')
      .notNull()
      .references(() => complaints.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id), // 创建时归属快照
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    content: text('content').notNull(), // 本次处理确认
    nextFollowUpDate: date('next_follow_up_date'),
    outcome: text('outcome').notNull(), // followed_up/resolved
    resolution: text('resolution'), // 解决结果（outcome=resolved 时必填）
  },
  (table) => [
    check('follow_ups_outcome_check', sql`${table.outcome} in ('followed_up','resolved')`),
    index('follow_ups_complaint_idx').on(table.complaintId),
  ],
)
