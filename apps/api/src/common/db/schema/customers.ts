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
import { users } from './org'
import { administrativeDivisions, salesRegions } from './geography'
import type { CustomerGrade } from '../../constants'

/**
 * 客户域（规格 §7.2 01 组织与客户域）：
 * customers（主表，owner_id 为归属唯一事实源）/ contacts（联系人）/
 * customer_transfers（移交历史）/ customer_claim_requests（接管申请）
 * 归属快照语义：子实体（商机/客诉/拜访）的 owner_id 为创建时快照，当前归属一律 JOIN 客户推导（§7.2 设计约定）
 */

// 客户导入批次：保留冷启动数据口径、默认归属和处理结果；不保存原始文件。
export const customerImportBatches = pgTable(
  'customer_import_batches',
  {
    ...baseColumns,
    fileName: text('file_name').notNull(),
    status: text('status').notNull().default('uploaded'),
    defaultRelationship: text('default_relationship').notNull(),
    dataCutoffOn: date('data_cutoff_on'),
    defaultOwnerId: uuid('default_owner_id').references(() => users.id),
    targetStatus: text('target_status').notNull().default('active'),
    createdById: uuid('created_by_id')
      .notNull()
      .references(() => users.id),
    totalRows: integer('total_rows').notNull().default(0),
    readyRows: integer('ready_rows').notNull().default(0),
    importedRows: integer('imported_rows').notNull().default(0),
    skippedRows: integer('skipped_rows').notNull().default(0),
    failedRows: integer('failed_rows').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    check(
      'customer_import_batches_status_check',
      sql`${table.status} in ('uploaded','previewed','importing','completed','failed')`,
    ),
    check(
      'customer_import_batches_relationship_check',
      sql`${table.defaultRelationship} in ('pre_crm_existing','prospect','per_row')`,
    ),
    check(
      'customer_import_batches_target_status_check',
      sql`${table.targetStatus} in ('active','public')`,
    ),
  ],
)

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
    industry: text('industry'), // 客户行业（独立字典维度）
    subIndustry: text('sub_industry'), // 具体领域（与客户行业正交，不是父子层级）
    customerType: text('customer_type'), // 客户类型（字典快照）
    productLines: jsonb('product_lines').$type<string[]>().default([]).notNull(), // 产品线（字典快照）
    city: text('city'),
    province: text('province'),
    cityCode: text('city_code').references(() => administrativeDivisions.code),
    provinceCode: text('province_code').references(() => administrativeDivisions.code),
    salesRegionId: uuid('sales_region_id').references(() => salesRegions.id),
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
    preCrmDealConfirmed: boolean('pre_crm_deal_confirmed').default(false).notNull(), // CRM 启用前已成交的历史事实
    preCrmSalesAmount: numeric('pre_crm_sales_amount', { precision: 14, scale: 2 }), // 可空：未知不等于 0
    importBatchId: uuid('import_batch_id').references(() => customerImportBatches.id),
    notes: text('notes'),
    entrySource: text('entry_source'), // AI 录入来源（§7.1 预留）
    entryRefId: uuid('entry_ref_id'), // AI 素材引用（§7.1 预留）
  },
  (table) => [
    // 只有外部权威标识硬拦截；名称归一化可能误伤不同法人，只做候选检索。
    index('customers_normalized_key_idx').on(table.normalizedKey),
    index('customers_city_code_idx').on(table.cityCode),
    index('customers_sales_region_idx').on(table.salesRegionId),
    uniqueIndex('customers_code_uq').on(table.customerCode),
    uniqueIndex('customers_credit_code_uq').on(table.unifiedSocialCreditCode),
    check('customers_grade_check', sql`${table.grade} in ('S','A','B','C')`),
    check('customers_status_check', sql`${table.status} in ('active','invalid','public')`),
    check(
      'customers_lifecycle_check',
      sql`(${table.status} = 'active' and ${table.ownerId} is not null)
        or (${table.status} in ('public','invalid') and ${table.ownerId} is null)`,
    ),
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

// 导入行：保存字段映射后的预览、查重结论和逐行结果，便于失败重试与审计。
export const customerImportRows = pgTable(
  'customer_import_rows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => customerImportBatches.id, { onDelete: 'cascade' }),
    rowNumber: integer('row_number').notNull(),
    rawData: jsonb('raw_data').$type<Record<string, string | number | boolean | null>>().notNull(),
    normalizedData: jsonb('normalized_data').$type<Record<string, unknown>>(),
    status: text('status').notNull().default('uploaded'),
    error: text('error'),
    duplicateCustomerId: uuid('duplicate_customer_id').references(() => customers.id),
    customerId: uuid('customer_id').references(() => customers.id),
  },
  (table) => [
    check(
      'customer_import_rows_status_check',
      sql`${table.status} in ('uploaded','ready','duplicate','invalid','imported','skipped','failed')`,
    ),
    uniqueIndex('customer_import_rows_batch_row_uq').on(table.batchId, table.rowNumber),
    index('customer_import_rows_batch_status_idx').on(table.batchId, table.status),
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
export const customerTransfers = pgTable(
  'customer_transfers',
  {
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
    eventType: text('event_type').notNull().default('transferred'),
    fromStatus: text('from_status'),
    toStatus: text('to_status'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(), // 业务时间
  },
  (table) => [
    check(
      'customer_transfers_event_type_check',
      sql`${table.eventType} in ('transferred','released_to_pool','claimed_from_pool','marked_invalid','restored_from_invalid','claim_approved')`,
    ),
    check(
      'customer_transfers_from_status_check',
      sql`${table.fromStatus} is null or ${table.fromStatus} in ('active','public','invalid')`,
    ),
    check(
      'customer_transfers_to_status_check',
      sql`${table.toStatus} is null or ${table.toStatus} in ('active','public','invalid')`,
    ),
  ],
)

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
