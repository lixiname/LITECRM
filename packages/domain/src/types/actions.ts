import type { components } from '@crm/contracts'

// 业务动作域类型（§7.2 非 API 类型留 domain 层；枚举从 contracts import）
export type VisitMethod = components['schemas']['VisitMethod']
export type VisitType = components['schemas']['VisitType']
export type OpportunityStage = components['schemas']['OpportunityStage']
export type AmountType = components['schemas']['AmountType']
export type OpportunitySource = components['schemas']['OpportunitySource']
export type ComplaintType = components['schemas']['ComplaintType']
export type ComplaintStatus = components['schemas']['ComplaintStatus']
export type FollowUpOutcome = components['schemas']['FollowUpOutcome']
export type TradeType = components['schemas']['TradeType']

export interface VisitRecord {
  id: string
  customerId: string
  ownerId: string
  occurredAt: string
  method: VisitMethod
  visitType: VisitType | null
  businessSituation: string | null
  equipmentSituation: string | null
  personnelChanges: string | null
  nextFollowUpDate: string | null
  nextFollowUpAction: string | null
  createdAt: string
}

export interface Opportunity {
  id: string
  customerId: string
  ownerId: string
  name: string
  stage: OpportunityStage
  source: OpportunitySource
  productLine: string | null
  amountType: AmountType
  amount: string | null
  approximate: boolean
  amountNote: string | null
  expectedCloseDate: string | null
  lastFollowUpAt: string | null
  nextAction: string | null
  nextFollowUpDate: string | null
  closedAt: string | null
  closeReason: string | null
  notes: string | null
  createdAt: string
}

export interface Deal {
  id: string
  customerId: string
  amount: string | null
  tradeType: TradeType | null
  occurredAt: string
  sourceOpportunityId: string | null
}

export interface Complaint {
  id: string
  customerId: string
  ownerId: string
  occurredAt: string
  type: ComplaintType
  status: ComplaintStatus
  description: string
  nextFollowUpDate: string | null
  resolution: string | null
  resolvedAt: string | null
  createdAt: string
}

// ===== UI 选项常量 =====

export const VISIT_METHOD_OPTIONS: { value: VisitMethod; label: string }[] = [
  { value: 'offline_visit', label: '线下拜访' },
  { value: 'remote', label: '远程' },
  { value: 'other', label: '其他' },
]

export const VISIT_TYPE_OPTIONS: { value: VisitType; label: string }[] = [
  { value: 'new_customer', label: '新客户开发' },
  { value: 'existing_maintenance', label: '存量维护' },
  { value: 'industry_relation', label: '行业关系' },
]

export const OPPORTUNITY_STAGE_OPTIONS: { value: OpportunityStage; label: string }[] = [
  { value: 'intent', label: '意向' },
  { value: 'following', label: '跟进中' },
  { value: 'ordered', label: '已成交' },
  { value: 'lost', label: '已丢失' },
  { value: 'demand_disappeared', label: '需求消失' },
]

export const OPPORTUNITY_SOURCE_OPTIONS: { value: OpportunitySource; label: string }[] = [
  { value: 'referral', label: '转介绍' },
  { value: 'cold_call', label: '陌拜' },
  { value: 'exhibition', label: '展会' },
  { value: 'online', label: '线上' },
  { value: 'other', label: '其他' },
]

export const COMPLAINT_TYPE_OPTIONS: { value: ComplaintType; label: string }[] = [
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
