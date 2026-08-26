import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './common'
import { users } from './org'
import type { CustomerGrade } from '../../constants'

/**
 * 客户域（规格 §7.2 01 组织与客户域）：
 * customers（主表，owner_id 为归属唯一事实源）/ contacts（联系人）/
 * customer_transfers（移交历史）/ customer_claim_requests（接管申请）
 * 归属快照语义：子实体（商机/客诉/拜访）的 owner_id 为创建时快照，当前归属一律 JOIN 客户推导（§7.2 设计约定）
 */

// 客户主表：ERP 编码/信用代码是可空硬唯一键；normalized_key 仅用于疑似重复检索。
export const customers = pgTable(
  'customers',
  {
    ...baseColumns,
    name: text('name').notNull(), // 可地址式名称
    normalizedKey: text('normalized_key').notNull(), // 查重键：归一化后（去空格/大小写/去后缀）
    customerCode: text('customer_code'), // ERP 编码（可选，权威硬查重）
    unifiedSocialCreditCode: text('unified_social_credit_code'), // 统一社会信用代码（可选，权威硬查重）
    aliasNames: jsonb('alias_names').$type<string[]>().default([]).notNull(), // 别名/简称
    industry: text('industry'), // 产业（字典快照）
    subIndustry: text('sub_industry'), // 二级行业（字典快照）
    customerType: text('customer_type'), // 客户类型（字典快照）
    productLines: jsonb('product_lines').$type<string[]>().default([]).notNull(), // 产品线（字典快照）
    city: text('city'),
    province: text('province'),
    address: text('address'),
    website: text('website'),
    parentCustomerId: uuid('parent_customer_id'), // 集团预留（自引用，extra config 定义）
    source: text('source'), // 客户来源（字典快照）
    grade: text('grade').$type<CustomerGrade>().notNull().default('C'), // 客户经营分级 S/A/B/C
    status: text('status').notNull().default('active'), // active 在案 / invalid 无效 / public 公海
    ownerId: uuid('owner_id').references(() => users.id), // 当前归属（唯一事实源，公海=null）
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id), // 建档人（与 owner 语义分离 §8.3）
    firstVisitedAt: timestamp('first_visited_at', { withTimezone: true }), // 派生（M3 事件写入）
    firstDealAt: timestamp('first_deal_at', { withTimezone: true }), // 派生（M3 事件写入）
    lastActivityAt: timestamp('last_activity_at', { withTimezone: true }), // 派生
    notes: text('notes'),
    entrySource: text('entry_source'), // AI 录入来源（§7.1 预留）
    entryRefId: uuid('entry_ref_id'), // AI 素材引用（§7.1 预留）
  },
  (table) => [
    // 只有外部权威标识硬拦截；名称归一化可能误伤不同法人，只做候选检索。
    index('customers_normalized_key_idx').on(table.normalizedKey),
    uniqueIndex('customers_code_uq').on(table.customerCode),
    uniqueIndex('customers_credit_code_uq').on(table.unifiedSocialCreditCode),
    check('customers_grade_check', sql`${table.grade} in ('S','A','B','C')`),
    check('customers_status_check', sql`${table.status} in ('active','invalid','public')`),
    // 模糊检索（§7.3 模糊层）：pg_trgm + GIN 加速
    index('customers_name_trgm_idx').using('gin', sql`${table.name} gin_trgm_ops`),
    index('customers_key_trgm_idx').using('gin', sql`${table.normalizedKey} gin_trgm_ops`),
    // 集团自引用外键（须放 extra config 避免 TS 循环推断）
    foreignKey({
      columns: [table.parentCustomerId],
      foreignColumns: [table.id],
    }),
  ],
)

// 客户等级变更历史：append-only；初始等级保留在 customers，后续变更逐条留痕。
export const customerGradeChanges = pgTable(
  'customer_grade_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    fromGrade: text('from_grade').$type<CustomerGrade>().notNull(),
    toGrade: text('to_grade').$type<CustomerGrade>().notNull(),
    changedById: uuid('changed_by_id')
      .notNull()
      .references(() => users.id),
    reason: text('reason'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('customer_grade_changes_from_check', sql`${table.fromGrade} in ('S','A','B','C')`),
    check('customer_grade_changes_to_check', sql`${table.toGrade} in ('S','A','B','C')`),
    check('customer_grade_changes_changed_check', sql`${table.fromGrade} <> ${table.toGrade}`),
    index('customer_grade_changes_customer_occurred_idx').on(table.customerId, table.occurredAt),
  ],
)

// 联系人（§7.2：name 可空 = 裸电话场景；每客户至多一个首要联系人）
export const contacts = pgTable(
  'contacts',
  {
    ...baseColumns,
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    name: text('name'), // 可空（裸电话）
    title: text('title'),
    phone: text('phone'), // 脱敏展示由前端处理
    isKeyContact: boolean('is_key_contact').default(false).notNull(), // 首要联系人（承担客户主电话角色）
  },
  (table) => [
    // 部分唯一索引：每客户至多一个 is_key_contact=true（§7.2）
    uniqueIndex('contacts_key_contact_uq')
      .on(table.customerId, table.isKeyContact)
      .where(sql`${table.isKeyContact}`),
  ],
)

// 移交历史（§8.3：append-only，业务时间，归属快照语义）
export const customerTransfers = pgTable('customer_transfers', {
  ...baseColumns,
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id),
  fromOwnerId: uuid('from_owner_id').references(() => users.id), // 可空=从公海
  toOwnerId: uuid('to_owner_id').references(() => users.id), // 可空=释放到公海
  operatedById: uuid('operated_by_id')
    .notNull()
    .references(() => users.id),
  reason: text('reason').notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(), // 业务时间
})

// 接管申请（§8.3：状态机 pending→approved/rejected/withdrawn；current_owner_id 归属快照校验）
export const customerClaimRequests = pgTable(
  'customer_claim_requests',
  {
    ...baseColumns,
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    applicantId: uuid('applicant_id')
      .notNull()
      .references(() => users.id),
    currentOwnerId: uuid('current_owner_id').references(() => users.id), // 发起时归属快照（并发防护）
    reason: text('reason').notNull(),
    status: text('status').notNull().default('pending'),
    reviewedById: uuid('reviewed_by_id').references(() => users.id), // 审批人
    reviewComment: text('review_comment'), // 审批/拒绝意见
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'claims_status_check',
      sql`${table.status} in ('pending','approved','rejected','withdrawn')`,
    ),
    // 并发防护（§8.3）：同客户仅一条 pending，用部分唯一索引硬约束
    uniqueIndex('claims_pending_uq')
      .on(table.customerId)
      .where(sql`${table.status} = 'pending'`),
  ],
)

// 业务选项字典（§7.2：稳定字典值与展示名称分离，维度内 value 唯一）
export const customerDimensionOptions = pgTable(
  'customer_dimension_options',
  {
    ...baseColumns,
    dimension: text('dimension').notNull(),
    name: text('name').notNull(), // 稳定字典值（历史业务数据保存此值）
    label: text('label').notNull().default(''), // 面向用户的展示名称
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    check(
      'dimension_check',
      sql`${table.dimension} in ('industry','sub_industry','customer_type','product_line','source','complaint_type','trade_type','opportunity_source','visit_type')`,
    ),
    uniqueIndex('dimension_name_uq').on(table.dimension, table.name),
  ],
)
