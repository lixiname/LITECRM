// 权限基础设施：角色、能力点、数据范围（规格 §6.1 / §6.2）
// 混合访问控制：RBAC 管操作（能力点）× 组织树管数据范围，服务端唯一裁决

export const ROLES = ['sales', 'executive', 'assistant', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const DATA_SCOPES = ['self', 'team', 'full'] as const
export type DataScope = (typeof DATA_SCOPES)[number]

// 能力点 = 操作维度（RBAC）
export const ABILITIES = [
  'customer.write', // 基础填报：拜访/商机/客诉
  'customer.transfer', // 客户移交/接管申请
  'customer.release', // 本人/管理范围内客户释放至公海
  'customer.claim', // 从本销售区域公海认领给本人
  'customer.invalidate', // 标记客户无效（区域负责人/管理员）
  'customer.restore', // 恢复无效客户（区域负责人/管理员）
  'customer.import', // 客户 Excel 批量导入（管理员）
  'approve.claim', // 接管审批
  'dashboard.view', // 经营看板（漏斗/储备/转化，方案 A 专属 executive）
  'stats.view', // 全量统计（只读）
  'export', // 导出
  'user.manage', // 系统配置/用户管理
] as const
export type Ability = (typeof ABILITIES)[number]

// 角色 → 能力点（规格 §6.2 表格）
export const ROLE_ABILITIES: Record<Role, readonly Ability[]> = {
  sales: ['customer.write', 'customer.transfer', 'customer.release', 'customer.claim'],
  executive: [
    'customer.write',
    'customer.transfer',
    'customer.release',
    'customer.claim',
    'customer.invalidate',
    'customer.restore',
    'approve.claim',
    'dashboard.view',
  ],
  assistant: ['stats.view', 'export'],
  admin: [...ABILITIES],
}

// 角色 → 数据范围（组织树自动推导；admin/assistant 短路为 full，§6.1）
export const ROLE_DATA_SCOPE: Record<Role, DataScope> = {
  sales: 'self',
  executive: 'team',
  assistant: 'full',
  admin: 'full',
}

// ===== M2 客户域枚举（§7.2：varchar + CHECK + 应用层枚举，不用 PG enum）=====

// 客户等级：只描述客户经营价值/优先级，不描述销售人员能力等级
export const CUSTOMER_GRADES = ['S', 'A', 'B', 'C'] as const
export type CustomerGrade = (typeof CUSTOMER_GRADES)[number]

// 客户状态（§8.3：active 在案 / invalid 无效 / public 公海）
export const CUSTOMER_STATUSES = ['active', 'invalid', 'public'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

// 接管申请状态机（§8.3）
export const CLAIM_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

// 字典维度（§7.2 customer_dimension_options；客户维度 + 业务分类选项，全部可配置）
export const CUSTOMER_DIMENSIONS = [
  'industry', // 客户行业
  'sub_industry', // 具体领域（与客户行业正交）
  'customer_type', // 客户类型
  'product_line', // 产品线
  'source', // 客户来源
  'complaint_type', // 客诉类型（§7.2 字典）
  'trade_type', // 成交交易性质（§7.2 字典）
  'opportunity_source', // 商机发现渠道
  'visit_type', // 拜访类型
] as const
export type CustomerDimension = (typeof CUSTOMER_DIMENSIONS)[number]

// ===== M3 业务动作域枚举（§7.2：varchar + CHECK + 应用层枚举）=====

// 拜访方式（§7.2 visit_records.method；固定枚举不字典化）
export const VISIT_METHODS = ['offline_visit', 'remote', 'other'] as const
export type VisitMethod = (typeof VISIT_METHODS)[number]

// 拜访类型（visit_type）已字典化：dimension='visit_type'，见 customer_dimension_options

// 商机阶段状态机（§8.5）
export const OPPORTUNITY_STAGES = [
  'intent', // 意向
  'following', // 跟进
  'won', // 客户明确下单（生成 Deal）
  'lost', // 丢失
  'demand_disappeared', // 需求消失
] as const
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]

export const OPPORTUNITY_QUOTE_KINDS = ['oral', 'formal'] as const
export type OpportunityQuoteKind = (typeof OPPORTUNITY_QUOTE_KINDS)[number]

export const OPPORTUNITY_INITIAL_AMOUNT_BASES = ['estimate', 'oral_quote', 'formal_quote'] as const
export type OpportunityInitialAmountBasis = (typeof OPPORTUNITY_INITIAL_AMOUNT_BASES)[number]

export const OPPORTUNITY_QUOTE_STATUSES = ['active', 'superseded', 'withdrawn'] as const
export type OpportunityQuoteStatus = (typeof OPPORTUNITY_QUOTE_STATUSES)[number]

// 商机发现渠道（opportunity_source）已字典化：dimension='opportunity_source'

// 商机事件类型（§7.2 opportunity_events.type，只追加）
export const OPPORTUNITY_EVENT_TYPES = ['created', 'stage_changed', 'updated'] as const
export type OpportunityEventType = (typeof OPPORTUNITY_EVENT_TYPES)[number]

// 客诉类型（complaint_type）已字典化：dimension='complaint_type'（§7.2 字典）

// 客诉状态（§8.6：两态，核心管理终态）
export const COMPLAINT_STATUSES = ['registered', 'resolved'] as const
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number]

// 客诉跟进结果（§8.6 complaint_follow_ups.outcome）
export const FOLLOW_UP_OUTCOMES = ['followed_up', 'resolved'] as const
export type FollowUpOutcome = (typeof FOLLOW_UP_OUTCOMES)[number]

// 成交交易性质（trade_type）已字典化：dimension='trade_type'（§7.2 字典）

// ===== M4 计划费用域枚举（§7.2：varchar + CHECK + 应用层枚举）=====

// 费用三态（§8.8：draft 不计入 / submitted 计入 / voided 剔除留痕）
export const EXPENSE_STATUSES = ['draft', 'submitted', 'voided'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

// 指导意见多态目标（§8.7）
export const FOLLOW_UP_ACTION_STATUSES = ['pending', 'completed', 'cancelled'] as const
export type FollowUpActionStatus = (typeof FOLLOW_UP_ACTION_STATUSES)[number]

// 计划准备执行的业务流程；与计划由谁产生（originType）是两个独立维度。
export const SALES_PLAN_KINDS = [
  'customer_visit',
  'opportunity_follow_up',
  'complaint_follow_up',
] as const
export type SalesPlanKind = (typeof SALES_PLAN_KINDS)[number]

export const FOLLOW_UP_ACTION_SOURCE_TYPES = [
  'manual',
  'visit',
  'opportunity',
  'opportunity_follow_up',
  'opportunity_quote',
  'complaint',
  'complaint_follow_up',
] as const
export type FollowUpActionSourceType = (typeof FOLLOW_UP_ACTION_SOURCE_TYPES)[number]

export const COMMENT_TARGET_TYPES = ['weekly_plan', 'follow_up_action', 'visit'] as const
export type CommentTargetType = (typeof COMMENT_TARGET_TYPES)[number]
