import type { components } from '@crm/contracts'
import type {
  Complaint,
  FollowUpAction,
  Opportunity,
  OpportunityFollowUp,
  OpportunityActivityItem,
  OpportunityQuote,
  SalesPlan,
} from './actions'

// 客户域类型（§7.2 非 API 类型留 domain 层；枚举/请求体从 contracts import）
export type CustomerGrade = components['schemas']['CustomerGrade']
export type CustomerStatus = components['schemas']['CustomerStatus']
export type ClaimStatus = components['schemas']['ClaimStatus']
export type CustomerDimension = components['schemas']['CustomerDimension']
export type CustomerRelationshipStage = 'prospect' | 'new_customer' | 'existing_customer'

export interface CustomerItem {
  id: string
  version: number
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
  cityCode: string | null
  provinceCode: string | null
  salesRegionId: string | null
  salesRegionName?: string | null
  address: string | null
  website: string | null
  source: string | null
  grade: CustomerGrade
  status: CustomerStatus
  ownerId: string | null
  createdById: string
  firstVisitedAt: string | null
  firstDealAt: string | null
  lastActivityAt: string | null
  preCrmDealConfirmed: boolean
  preCrmSalesAmount: string | null
  importBatchId: string | null
  relationshipStage: CustomerRelationshipStage
  notes: string | null
  createdAt: string
  updatedAt: string
  ownerName?: string | null
  openOpportunityCount?: number
  openOpportunityAmount?: string
  activeOpportunityStage?: 'intent' | 'following' | null
  nextActionAt?: string | null
  nextActionContent?: string | null
}

export interface Contact {
  id: string
  customerId: string
  name: string | null
  title: string | null
  functionRole: string | null
  phone: string | null
  isKeyContact: boolean
  version: number
}

export interface CustomerDetail extends CustomerItem {
  currentVisitPlan?: SalesPlan | null
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
    crmAmount: string
    preCrmAmount: string | null
    referenceTotalAmount: string
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
  latestFollowUp: OpportunityFollowUp | null
  customerName: string
  activity: OpportunityActivityItem[]
}

export interface CustomerComplaintSummary extends Omit<Complaint, 'currentAction'> {
  currentAction: FollowUpAction | null
}

export interface CustomerTimelineItem {
  type:
    | 'visit'
    | 'opportunity'
    | 'opportunity_follow_up'
    | 'quote'
    | 'complaint'
    | 'complaint_follow_up'
    | 'deal'
    | 'ownership_event'
  id: string
  occurredAt: string
  title: string
  summary: string
  targetType: 'customer' | 'opportunity' | 'complaint'
  targetId: string
  metadata?: Record<string, string | null>
}

export const CUSTOMER_RELATIONSHIP_STAGE_OPTIONS: {
  value: CustomerRelationshipStage
  label: string
}[] = [
  { value: 'prospect', label: '潜在客户' },
  { value: 'new_customer', label: '本年新客户' },
  { value: 'existing_customer', label: '老客户' },
]

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
  customerStatus?: CustomerStatus
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
  version: number
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
