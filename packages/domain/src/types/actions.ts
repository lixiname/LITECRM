import type { components } from '@crm/contracts'

// 业务动作域类型（§7.2 非 API 类型留 domain 层；枚举从 contracts import）
// 字典化的业务分类（complaint_type/trade_type/opportunity_source/visit_type）为 string，选项可配置见字典
export type VisitMethod = components['schemas']['VisitMethod']
export type OpportunityStage = 'intent' | 'following' | 'won' | 'lost' | 'demand_disappeared'
export type OpportunityQuoteKind = components['schemas']['OpportunityQuoteKind']
export type ComplaintStatus = components['schemas']['ComplaintStatus']
export type FollowUpOutcome = components['schemas']['FollowUpOutcome']

export type FollowUpActionStatus = 'pending' | 'completed' | 'cancelled'
export type FollowUpActionSourceType =
  | 'manual'
  | 'visit'
  | 'opportunity'
  | 'opportunity_follow_up'
  | 'opportunity_quote'
  | 'complaint'
  | 'complaint_follow_up'

export interface FollowUpAction {
  id: string
  ownerId: string
  customerId: string | null
  opportunityId: string | null
  complaintId: string | null
  sourceType: FollowUpActionSourceType
  sourceId: string | null
  plannedAt: string
  content: string
  status: FollowUpActionStatus
  completedAt: string | null
  cancelReason: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface VisitRecord {
  id: string
  customerId: string
  ownerId: string
  occurredAt: string
  method: VisitMethod
  visitType: string | null
  businessSituation: string | null
  equipmentSituation: string | null
  personnelChanges: string | null
  createdAt: string
}

export interface OpportunityFollowUp {
  id: string
  opportunityId: string
  actorId: string
  sourceVisitId: string | null
  occurredAt: string
  conclusion: string
  method: string | null
  createdAt: string
}

export interface OpportunityQuote {
  id: string
  opportunityId: string
  actorId: string
  kind: OpportunityQuoteKind
  quotedAt: string
  amount: string
  quoteNo: string | null
  status: 'active' | 'superseded' | 'withdrawn'
  supersedesQuoteId: string | null
  note: string | null
  documentRef: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface Opportunity {
  id: string
  customerId: string
  ownerId: string
  name: string
  stage: OpportunityStage
  source: string
  productLine: string | null
  estimatedAmount: string | null
  approximate: boolean
  estimateNote: string | null
  discoveredDate: string | null
  expectedCloseDate: string | null
  lastFollowUpAt: string | null
  closedAt: string | null
  closeReason: string | null
  notes: string | null
  version: number
  currentAction?: FollowUpAction | null
  latestQuote?: OpportunityQuote | null
  createdAt: string
}

export interface Deal {
  id: string
  customerId: string
  amount: string
  tradeType: string | null
  occurredAt: string
  sourceOpportunityId: string
  sourceQuoteId: string | null
}

export interface Complaint {
  id: string
  customerId: string
  ownerId: string
  occurredAt: string
  type: string
  status: ComplaintStatus
  description: string
  resolution: string | null
  resolvedAt: string | null
  version: number
  currentAction?: FollowUpAction | null
  createdAt: string
}

// ===== UI 选项常量（字典 key → 显示文案映射；选项集合本身在 customer_dimension_options 可配置）=====

export const VISIT_METHOD_OPTIONS: { value: VisitMethod; label: string }[] = [
  { value: 'offline_visit', label: '线下拜访' },
  { value: 'remote', label: '远程' },
  { value: 'other', label: '其他' },
]

export const VISIT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'new_customer', label: '新客户开发' },
  { value: 'existing_maintenance', label: '存量维护' },
  { value: 'industry_relation', label: '行业关系' },
]

export const OPPORTUNITY_STAGE_OPTIONS: { value: OpportunityStage; label: string }[] = [
  { value: 'intent', label: '意向' },
  { value: 'following', label: '跟进中' },
  { value: 'won', label: '已成交' },
  { value: 'lost', label: '已丢失' },
  { value: 'demand_disappeared', label: '需求消失' },
]

export const OPPORTUNITY_SOURCE_OPTIONS: { value: string; label: string }[] = [
  { value: 'referral', label: '转介绍' },
  { value: 'cold_call', label: '陌拜' },
  { value: 'exhibition', label: '展会' },
  { value: 'online', label: '线上' },
  { value: 'other', label: '其他' },
]

export const COMPLAINT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'product_quality', label: '产品质量' },
  { value: 'delivery', label: '交期' },
  { value: 'service', label: '服务' },
  { value: 'logistics', label: '物流' },
  { value: 'price', label: '价格' },
  { value: 'other', label: '其他' },
]

export const COMPLAINT_STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: 'registered', label: '登记中' },
  { value: 'resolved', label: '已解决' },
]
