import type { components } from '@crm/contracts'
import type { Complaint, FollowUpAction, Opportunity, OpportunityQuote } from './actions'

// 客户域类型（§7.2 非 API 类型留 domain 层；枚举/请求体从 contracts import）
export type CustomerGrade = components['schemas']['CustomerGrade']
export type CustomerStatus = components['schemas']['CustomerStatus']
export type ClaimStatus = components['schemas']['ClaimStatus']
export type CustomerDimension = components['schemas']['CustomerDimension']

export interface CustomerItem {
  id: string
  name: string
  normalizedKey: string
  customerCode: string | null
  unifiedSocialCreditCode: string | null
  aliasNames: string[]
  industry: string | null
  subIndustry: string | null
  customerType: string | null
  productLines: string[]
  city: string | null
  province: string | null
  address: string | null
  source: string | null
  grade: CustomerGrade
  status: CustomerStatus
  ownerId: string | null
  createdById: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface Contact {
  id: string
  customerId: string
  name: string | null
  title: string | null
  phone: string | null
  isKeyContact: boolean
}

export interface CustomerDetail extends CustomerItem {
  opportunities?: CustomerOpportunitySummary[]
  complaints?: CustomerComplaintSummary[]
  latestDeals?: {
    id: string
    amount: string
    occurredAt: string
    sourceOpportunityId: string
  }[]
  dealSummary?: {
    count: number
    totalAmount: string
  }
  timeline?: CustomerTimelineItem[]
  contacts: Contact[]
}

export interface CustomerOpportunitySummary extends Omit<
  Opportunity,
  'currentAction' | 'latestQuote'
> {
  currentAction: FollowUpAction | null
  latestQuote: OpportunityQuote | null
  customerName: string
}

export interface CustomerComplaintSummary extends Omit<Complaint, 'currentAction'> {
  currentAction: FollowUpAction | null
}

export interface CustomerTimelineItem {
  type: 'visit' | 'opportunity_follow_up' | 'complaint' | 'deal'
  id: string
  occurredAt: string
  title: string
  summary: string
}

export interface CustomerPage {
  items: CustomerItem[]
  total: number
  page: number
  pageSize: number
}

export type DedupConfidence = 'high' | 'medium' | 'low'

export interface DedupHit {
  candidateId: string
  candidateName: string
  candidateCity: string | null
  confidence: DedupConfidence
  reasons: string[]
}

export interface ClaimListItem {
  id: string
  customerId: string
  customerName: string
  applicantId: string
  applicantName: string
  currentOwnerId: string | null
  reason: string
  status: ClaimStatus
  createdAt: string
}

export interface DimensionOption {
  id: string
  dimension: CustomerDimension
  name: string
  label: string
  sortOrder: number
  isActive: boolean
}

// ===== UI 选项常量（domain 层，组件不写枚举字面量）=====

export const CUSTOMER_GRADE_OPTIONS: CustomerGrade[] = ['S', 'A', 'B', 'C']

export const CUSTOMER_STATUS_OPTIONS: { value: CustomerStatus; label: string }[] = [
  { value: 'active', label: '在案' },
  { value: 'public', label: '公海' },
  { value: 'invalid', label: '无效' },
]

export const DEDUP_CONFIDENCE_LABELS: Record<DedupConfidence, string> = {
  high: '高度疑似',
  medium: '疑似重复',
  low: '可能相关',
}
