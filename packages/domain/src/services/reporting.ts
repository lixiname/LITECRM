import { apiGet } from './http'

export interface ReportingFilters {
  start: string
  end: string
  ownerId?: string
  salesRegionId?: string
  productLine?: string
}

export interface ReportingMember {
  id: string
  displayName: string
  role: string
}

export interface MetricValue {
  count: number
  amount: number
}

export interface PipelineBucket extends MetricValue {
  key: 'estimate' | 'oral_quote' | 'formal_quote'
  label: string
}

export interface PipelineOwnerRow {
  ownerId: string
  ownerName: string
  openCount: number
  openAmount: number
  estimateAmount: number
  oralQuoteAmount: number
  formalQuoteAmount: number
  stagnantCount: number
  stagnantAmount: number
  wonCount: number
  wonAmount: number
}

export interface PipelineReport {
  range: { start: string; end: string }
  pool: { totalCount: number; totalAmount: number; buckets: PipelineBucket[] }
  flow: {
    created: MetricValue
    firstQuoted: MetricValue
    firstFormalQuoted: MetricValue
    won: MetricValue
    lost: MetricValue
    closedWinRate: number | null
  }
  byOwner: PipelineOwnerRow[]
}

export interface TeamMemberReport {
  ownerId: string
  ownerName: string
  visits: number
  opportunityFollowUps: number
  quotes: number
  quoteAmount: number
  complaintRecords: number
  actualRecordCount: number
  pendingCount: number
  overdueCount: number
  completedPlanCount: number
  topOverdue: {
    id: string
    customerId: string | null
    customerName: string
    content: string
    plannedAt: string
  }[]
}

export interface TeamReport {
  range: { start: string; end: string }
  members: TeamMemberReport[]
}

export interface KeyCustomerReportItem {
  id: string
  name: string
  grade: 'S' | 'A'
  ownerId: string
  ownerName: string
  salesRegionName: string | null
  lastActivityAt: string | null
  openOpportunityCount: number
  openOpportunityAmount: number
  unresolvedComplaintCount: number
  reasons: string[]
  needsAttention: boolean
}

export interface KeyCustomerReport {
  range: { start: string; end: string }
  totalCount: number
  attentionCount: number
  items: KeyCustomerReportItem[]
}

export interface ExpenseAmounts {
  tobaccoAlcohol: number
  gifts: number
  dining: number
  entertainment: number
  lodging: number
  amount: number
}

export interface ExpenseOwnerRow extends ExpenseAmounts {
  ownerId: string
  ownerName: string
  draftDays: number
}

export interface ExpenseReport {
  range: { start: string; end: string }
  total: ExpenseAmounts & { draftDays: number }
  byOwner: ExpenseOwnerRow[]
}

export interface ReportingOverview {
  range: { start: string; end: string }
  pipeline: {
    openCount: number
    openAmount: number
    formalQuoteAmount: number
    wonAmount: number
    stagnantAmount: number
  }
  team: { actualRecordCount: number; pendingCount: number; overdueCount: number }
  keyCustomers: {
    totalCount: number
    attentionCount: number
    topAttention: KeyCustomerReportItem[]
  }
  expenses: { submittedAmount: number; draftDays: number }
}

function reportingPath(path: string, filters: ReportingFilters): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  return `/reporting/${path}?${params.toString()}`
}

export function listReportingMembers(): Promise<ReportingMember[]> {
  return apiGet('/reporting/members')
}

export function getReportingOverview(filters: ReportingFilters): Promise<ReportingOverview> {
  return apiGet(reportingPath('overview', filters))
}

export function getPipelineReport(filters: ReportingFilters): Promise<PipelineReport> {
  return apiGet(reportingPath('pipeline', filters))
}

export function getTeamReport(filters: ReportingFilters): Promise<TeamReport> {
  return apiGet(reportingPath('team', filters))
}

export function getKeyCustomerReport(filters: ReportingFilters): Promise<KeyCustomerReport> {
  return apiGet(reportingPath('key-customers', filters))
}

export function getExpenseReport(filters: ReportingFilters): Promise<ExpenseReport> {
  return apiGet(reportingPath('expenses', filters))
}
