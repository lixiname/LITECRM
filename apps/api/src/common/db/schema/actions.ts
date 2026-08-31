import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
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

/** 已发生事实与当前状态分开；未来动作统一由 follow_up_actions 维护。 */

export const visitRecords = pgTable(
  'visit_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id), // 填报人快照
    occurredAt: date('occurred_at').notNull(),
    method: text('method').notNull(),
    visitType: text('visit_type'),
    businessSituation: text('business_situation'),
    equipmentSituation: text('equipment_situation'),
    personnelChanges: text('personnel_changes'),
    sourcePlanId: uuid('source_plan_id'),
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    check('visits_method_check', sql`${table.method} in ('offline_visit','remote','other')`),
    index('visits_customer_idx').on(table.customerId),
    index('visits_owner_occurred_idx').on(table.ownerId, table.occurredAt),
    uniqueIndex('visits_source_plan_uq').on(table.sourcePlanId),
  ],
)

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
    name: text('name').notNull(),
    stage: text('stage').notNull().default('intent'),
    source: text('source').notNull(),
    initialAmountBasis: text('initial_amount_basis').notNull().default('estimate'),
    sourceRecordId: uuid('source_record_id').references(() => visitRecords.id),
    estimatedAmount: numeric('estimated_amount', { precision: 14, scale: 2 }),
    approximate: boolean('approximate').default(false).notNull(),
    estimateNote: text('estimate_note'),
    discoveredDate: date('discovered_date'),
    expectedCloseDate: date('expected_close_date'),
    lastFollowUpAt: date('last_follow_up_at'),
    closedAt: date('closed_at'),
    closeReason: text('close_reason'),
    notes: text('notes'),
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    check(
      'opportunities_stage_check',
      sql`${table.stage} in ('intent','following','won','lost','demand_disappeared')`,
    ),
    check(
      'opportunities_initial_amount_basis_check',
      sql`${table.initialAmountBasis} in ('estimate','oral_quote','formal_quote')`,
    ),
    index('opportunities_customer_idx').on(table.customerId),
    index('opportunities_owner_stage_idx').on(table.ownerId, table.stage),
  ],
)

export const opportunityProductLines = pgTable(
  'opportunity_product_lines',
  {
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    productLine: text('product_line').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('opportunity_product_lines_opp_product_uq').on(
      table.opportunityId,
      table.productLine,
    ),
    index('opportunity_product_lines_product_idx').on(table.productLine),
  ],
)

export const opportunityFollowUps = pgTable(
  'opportunity_follow_ups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    sourcePlanId: uuid('source_plan_id'),
    occurredAt: date('occurred_at').notNull(),
    conclusion: text('conclusion').notNull(),
    method: text('method'),
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    index('opportunity_follow_ups_opp_occurred_idx').on(table.opportunityId, table.occurredAt),
    uniqueIndex('opportunity_follow_ups_source_plan_uq').on(table.sourcePlanId),
  ],
)

export const opportunityQuotes = pgTable(
  'opportunity_quotes',
  {
    ...baseColumns,
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    followUpId: uuid('follow_up_id').references(() => opportunityFollowUps.id),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    quotedAt: date('quoted_at').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    quoteNo: text('quote_no'),
    status: text('status').notNull().default('active'),
    supersedesQuoteId: uuid('supersedes_quote_id'),
    sourcePlanId: uuid('source_plan_id'),
    note: text('note'),
    documentRef: text('document_ref'),
  },
  (table) => [
    check('opportunity_quotes_kind_check', sql`${table.kind} in ('oral','formal')`),
    check(
      'opportunity_quotes_status_check',
      sql`${table.status} in ('active','superseded','withdrawn')`,
    ),
    check('opportunity_quotes_amount_check', sql`${table.amount} >= 0`),
    index('opportunity_quotes_opp_quoted_idx').on(table.opportunityId, table.quotedAt),
    uniqueIndex('opportunity_quotes_follow_up_uq').on(table.followUpId),
    uniqueIndex('opportunity_quotes_one_active_uq')
      .on(table.opportunityId)
      .where(sql`${table.status} = 'active'`),
    foreignKey({ columns: [table.supersedesQuoteId], foreignColumns: [table.id] }),
    uniqueIndex('opportunity_quotes_source_plan_uq').on(table.sourcePlanId),
  ],
)

export const opportunityEvents = pgTable(
  'opportunity_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    opportunityId: uuid('opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    customerId: uuid('customer_id').notNull(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    occurredAt: date('occurred_at').notNull(),
    type: text('type').notNull(),
    schemaVersion: integer('schema_version').default(1).notNull(),
    payload: jsonb('payload'),
  },
  (table) => [
    check(
      'opportunity_events_type_check',
      sql`${table.type} in ('created','stage_changed','updated')`,
    ),
    index('opportunity_events_opp_occurred_idx').on(table.opportunityId, table.occurredAt),
  ],
)

export const deals = pgTable(
  'deals',
  {
    ...baseColumns,
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id), // 成交确认时客户负责人快照
    occurredAt: date('occurred_at').notNull(),
    amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
    productLine: text('product_line'),
    tradeTypes: jsonb('trade_types').$type<string[]>().default([]).notNull(),
    note: text('note'),
    sourceOpportunityId: uuid('source_opportunity_id')
      .notNull()
      .references(() => opportunities.id),
    sourceQuoteId: uuid('source_quote_id').references(() => opportunityQuotes.id),
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    uniqueIndex('deals_source_opportunity_uq').on(table.sourceOpportunityId),
    index('deals_customer_idx').on(table.customerId),
  ],
)

export const complaints = pgTable(
  'complaints',
  {
    ...baseColumns,
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    occurredAt: date('occurred_at').notNull(),
    type: text('type').notNull(),
    status: text('status').notNull().default('registered'),
    description: text('description').notNull(),
    resolution: text('resolution'),
    resolvedAt: date('resolved_at'),
    entrySource: text('entry_source'),
    entryRefId: uuid('entry_ref_id'),
  },
  (table) => [
    check('complaints_status_check', sql`${table.status} in ('registered','resolved')`),
    index('complaints_customer_idx').on(table.customerId),
    index('complaints_status_idx').on(table.status),
  ],
)

export const complaintFollowUps = pgTable(
  'complaint_follow_ups',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    complaintId: uuid('complaint_id')
      .notNull()
      .references(() => complaints.id),
    ownerId: uuid('owner_id')
      .notNull()
      .references(() => users.id),
    occurredAt: date('occurred_at').notNull(),
    content: text('content').notNull(),
    outcome: text('outcome').notNull(),
    resolution: text('resolution'),
    sourcePlanId: uuid('source_plan_id'),
  },
  (table) => [
    check('follow_ups_outcome_check', sql`${table.outcome} in ('followed_up','resolved')`),
    index('follow_ups_complaint_idx').on(table.complaintId, table.occurredAt),
    uniqueIndex('complaint_follow_ups_source_plan_uq').on(table.sourcePlanId),
  ],
)
