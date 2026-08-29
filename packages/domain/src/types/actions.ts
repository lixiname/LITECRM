import type { components } from '@crm/contracts'

// 业务动作域类型（§7.2 非 API 类型留 domain 层；枚举从 contracts import）
// 字典化的业务分类（complaint_type/trade_type/opportunity_source/visit_type）为 string，选项可配置见字典
export type VisitMethod = components['schemas']['VisitMethod']
export type OpportunityStage = 'intent' | 'following' | 'won' | 'lost' | 'demand_disappeared'
export type OpportunityQuoteKind = components['schemas']['OpportunityQuoteKind']
export type OpportunityInitialAmountBasis = components['schemas']['OpportunityInitialAmountBasis']
export type OpportunityQuoteStatus = 'active' | 'superseded' | 'withdrawn'
export type ComplaintStatus = components['schemas']['ComplaintStatus']
export type FollowUpOutcome = components['schemas']['FollowUpOutcome']

export type FollowUpActionStatus = 'pending' | 'completed' | 'cancelled'
export type SalesPlanKind = 'customer_visit' | 'opportunity_follow_up' | 'complaint_follow_up'
export type SalesPlanOriginType =
  | 'manual'
  | 'visit'
  | 'opportunity'
  | 'opportunity_follow_up'
  | 'opportunity_quote'
  | 'complaint'
  | 'complaint_follow_up'

export interface SalesPlan {
  id: string
  ownerId: string
  customerId: string | null
  opportunityId: string | null
  complaintId: string | null
  planKind: SalesPlanKind
  originType: SalesPlanOriginType
  sourceId: string | null
  plannedAt: string
  content: string
  status: FollowUpActionStatus
  completedAt: string | null
  cancelReason: string | null
  version: number
  createdAt: string
  updatedAt: string
  customerName?: string
  opportunityName?: string | null
}

export type FollowUpAction = SalesPlan
export type FollowUpActionSourceType = SalesPlanOriginType

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
  sourcePlanId: string | null
  createdAt: string
}

export interface OpportunityFollowUp {
  id: string
  opportunityId: string
  actorId: string
  sourcePlanId: string | null
  occurredAt: string
  conclusion: string
  method: string | null
  createdAt: string
}

export interface OpportunityQuote {
  id: string
  opportunityId: string
  followUpId: string | null
  actorId: string
  kind: OpportunityQuoteKind
  quotedAt: string
  amount: string
  quoteNo: string | null
  status: OpportunityQuoteStatus
  supersedesQuoteId: string | null
  sourcePlanId: string | null
  note: string | null
  documentRef: string | null
  version: number
  createdAt: string
  updatedAt: string
}

export interface Opportunity {
  id: string
  customerId: string
  customerName?: string
  currentOwnerId?: string | null
  currentOwnerName?: string | null
  ownerId: string
  name: string
  stage: OpportunityStage
  source: string
  productLines: string[]
  initialAmountBasis: OpportunityInitialAmountBasis
  estimatedAmount: string | null
  referenceAmount: string | null
  amountBasis: OpportunityInitialAmountBasis
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
  latestFollowUp?: OpportunityFollowUp | null
  lastBusinessActivityAt?: string
  inactiveDays?: number
  riskFlags?: OpportunityRiskFlag[]
  createdAt: string
}

export type OpportunityRiskFlag =
  'no_pending_action' | 'action_overdue' | 'inactive_30d' | 'expected_close_overdue'

export interface OpportunityPage {
  items: Opportunity[]
  total: number
  page: number
  pageSize: number
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
  customerName?: string
  currentOwnerId?: string | null
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

// ===== 固定业务枚举的 UI 选项（可配置分类统一从 catalog API 读取）=====

export const VISIT_METHOD_OPTIONS: { value: VisitMethod; label: string }[] = [
  { value: 'offline_visit', label: '线下拜访' },
  { value: 'remote', label: '远程' },
  { value: 'other', label: '其他' },
]

export const OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: 'phone', label: '电话' },
  { value: 'wechat', label: '微信' },
  { value: 'offline_visit', label: '现场拜访' },
  { value: 'email', label: '邮件' },
  { value: 'other', label: '其他' },
]

export const OPPORTUNITY_STAGE_OPTIONS: { value: OpportunityStage; label: string }[] = [
  { value: 'intent', label: '意向' },
  { value: 'following', label: '跟进中' },
  { value: 'won', label: '已成交' },
  { value: 'lost', label: '已丢失' },
  { value: 'demand_disappeared', label: '需求消失' },
]

export const OPPORTUNITY_QUOTE_KIND_OPTIONS: {
  value: OpportunityQuoteKind
  label: string
}[] = [
  { value: 'oral', label: '口头报价' },
  { value: 'formal', label: '正式报价' },
]

export const OPPORTUNITY_INITIAL_AMOUNT_BASIS_OPTIONS: {
  value: OpportunityInitialAmountBasis
  label: string
}[] = [
  { value: 'estimate', label: '预估金额' },
  { value: 'oral_quote', label: '口头报价' },
  { value: 'formal_quote', label: '正式报价单' },
]

export const OPPORTUNITY_QUOTE_STATUS_OPTIONS: {
  value: OpportunityQuoteStatus
  label: string
}[] = [
  { value: 'active', label: '有效' },
  { value: 'superseded', label: '已被替代' },
  { value: 'withdrawn', label: '已撤回' },
]

export const OPPORTUNITY_RISK_LABELS: Record<OpportunityRiskFlag, string> = {
  no_pending_action: '无下一计划',
  action_overdue: '计划已逾期',
  inactive_30d: '超过30天未推进',
  expected_close_overdue: '预计成交日已过',
}

export const COMPLAINT_STATUS_OPTIONS: { value: ComplaintStatus; label: string }[] = [
  { value: 'registered', label: '登记中' },
  { value: 'resolved', label: '已解决' },
]
