import type { components } from '@crm/contracts'
import { apiGet, apiPost } from './http'
import type {
  Deal,
  FollowUpAction,
  Opportunity,
  OpportunityFollowUp,
  OpportunityPage,
  OpportunityQuote,
} from '../types/actions'

export type CreateOpportunityInput = components['schemas']['CreateOpportunityDto']
export type CreateOpportunityFollowUpInput = components['schemas']['CreateOpportunityFollowUpDto']
export type CreateOpportunityQuoteInput = components['schemas']['CreateOpportunityQuoteDto']
export type WinOpportunityInput = components['schemas']['WinOpportunityDto']
export type CloseOpportunityInput = components['schemas']['CloseOpportunityDto']

export interface OpportunityDetail extends Opportunity {
  followUps: OpportunityFollowUp[]
  quotes: OpportunityQuote[]
  events: { id: string; type: string; occurredAt: string; payload: unknown }[]
  actions: FollowUpAction[]
  deal: Deal | null
}

export interface OpportunityListQuery {
  keyword?: string
  customerId?: string
  ownerId?: string
  salesRegionId?: string
  productLine?: string
  stage?: string
  minAmount?: number
  maxAmount?: number
  hasQuote?: boolean
  noNextAction?: boolean
  stagnant?: boolean
  page?: number
  pageSize?: number
}

/** 新建商机；报价依据时原子生成首条报价与反馈行动。 */
export function createOpportunity(dto: CreateOpportunityInput): Promise<Opportunity> {
  return apiPost<Opportunity>('/opportunities', dto)
}

/** 商机工作台（客户当前归属可见，支持检索、风险筛选和分页） */
export function listOpportunities(query: OpportunityListQuery = {}): Promise<OpportunityPage> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return apiGet<OpportunityPage>(`/opportunities${search ? `?${search}` : ''}`)
}

/** 商机详情（含跟进、报价、行动、事件与成交） */
export function getOpportunity(id: string): Promise<OpportunityDetail> {
  return apiGet<OpportunityDetail>(`/opportunities/${id}`)
}

/** 记录一次已发生的商机跟进，并安排下一行动。 */
export function addOpportunityFollowUp(
  id: string,
  dto: CreateOpportunityFollowUpInput,
): Promise<Opportunity> {
  return apiPost<Opportunity>(`/opportunities/${id}/follow-ups`, dto)
}

/** 记录一次口头或正式报价；报价不会自动成交。 */
export function addOpportunityQuote(
  id: string,
  dto: CreateOpportunityQuoteInput,
): Promise<OpportunityQuote> {
  return apiPost<OpportunityQuote>(`/opportunities/${id}/quotes`, dto)
}

/** 客户明确下单后确认成交，并生成唯一 Deal。 */
export function winOpportunity(
  id: string,
  dto: WinOpportunityInput,
): Promise<{ opportunity: Opportunity; deal: Deal }> {
  return apiPost(`/opportunities/${id}/win`, dto)
}

/** 结案（lost / demand_disappeared） */
export function closeOpportunity(id: string, dto: CloseOpportunityInput): Promise<Opportunity> {
  return apiPost<Opportunity>(`/opportunities/${id}/close`, dto)
}
