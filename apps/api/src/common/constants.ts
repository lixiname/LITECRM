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
  'approve.claim', // 接管审批
  'dashboard.view', // 经营看板（漏斗/储备/转化，方案 A 专属 executive）
  'stats.view', // 全量统计（只读）
  'export', // 导出
  'user.manage', // 系统配置/用户管理
] as const
export type Ability = (typeof ABILITIES)[number]

// 角色 → 能力点（规格 §6.2 表格）
export const ROLE_ABILITIES: Record<Role, readonly Ability[]> = {
  sales: ['customer.write', 'customer.transfer'],
  executive: ['customer.write', 'customer.transfer', 'approve.claim', 'dashboard.view'],
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

// 客户分级容量（§7.2 capacity_config 的 level）
export const CUSTOMER_LEVELS = ['S', 'A', 'B', 'C'] as const
export type CustomerLevel = (typeof CUSTOMER_LEVELS)[number]

// 客户状态（§8.3：active 在案 / invalid 无效 / public 公海）
export const CUSTOMER_STATUSES = ['active', 'invalid', 'public'] as const
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number]

// 接管申请状态机（§8.3）
export const CLAIM_STATUSES = ['pending', 'approved', 'rejected', 'withdrawn'] as const
export type ClaimStatus = (typeof CLAIM_STATUSES)[number]

// 客户维度配置（§7.2 customer_dimension_options 的 dimension）
export const CUSTOMER_DIMENSIONS = [
  'industry', // 产业
  'sub_industry', // 二级行业
  'customer_type', // 客户类型
  'product_line', // 产品线
  'source', // 客户来源
] as const
export type CustomerDimension = (typeof CUSTOMER_DIMENSIONS)[number]

// ===== M3 业务动作域枚举（§7.2：varchar + CHECK + 应用层枚举）=====

// 拜访方式（§7.2 visit_records.method）
export const VISIT_METHODS = ['offline_visit', 'remote', 'other'] as const
export type VisitMethod = (typeof VISIT_METHODS)[number]

// 拜访类型（§7.2 visit_records.visit_type）
export const VISIT_TYPES = ['new_customer', 'existing_maintenance', 'industry_relation'] as const
export type VisitType = (typeof VISIT_TYPES)[number]

// 商机阶段状态机（§8.5）
export const OPPORTUNITY_STAGES = [
  'intent', // 意向
  'following', // 跟进
  'ordered', // 转成交（生成 Deal）
  'lost', // 丢失
  'demand_disappeared', // 需求消失
] as const
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]

// 商机金额类型（§7.2：意向金额精度分层）
export const AMOUNT_TYPES = ['oral', 'quoted'] as const
export type AmountType = (typeof AMOUNT_TYPES)[number]

// 商机发现渠道（§7.2 opportunity.source，应用层枚举）
export const OPPORTUNITY_SOURCES = [
  'referral',
  'cold_call',
  'exhibition',
  'online',
  'other',
] as const
export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number]

// 商机事件类型（§7.2 opportunity_events.type，只追加）
export const OPPORTUNITY_EVENT_TYPES = ['created', 'stage_changed', 'updated'] as const
export type OpportunityEventType = (typeof OPPORTUNITY_EVENT_TYPES)[number]

// 客诉类型（§7.2 complaint.type，6 类）
export const COMPLAINT_TYPES = [
  'product_quality', // 产品质量
  'delivery', // 交期
  'service', // 服务
  'logistics', // 物流
  'price', // 价格
  'other', // 其他
] as const
export type ComplaintType = (typeof COMPLAINT_TYPES)[number]

// 客诉状态（§8.6：两态，核心管理终态）
export const COMPLAINT_STATUSES = ['registered', 'resolved'] as const
export type ComplaintStatus = (typeof COMPLAINT_STATUSES)[number]

// 客诉跟进结果（§8.6 complaint_follow_ups.outcome）
export const FOLLOW_UP_OUTCOMES = ['followed_up', 'resolved'] as const
export type FollowUpOutcome = (typeof FOLLOW_UP_OUTCOMES)[number]

// 成交交易性质（§7.2 deals.trade_type）
export const TRADE_TYPES = ['equipment', 'consumable', 'part', 'service'] as const
export type TradeType = (typeof TRADE_TYPES)[number]
