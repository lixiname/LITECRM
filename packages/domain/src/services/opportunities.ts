import type { components } from '@crm/contracts'
import { apiGet, apiPost } from './http'
import type { Deal, Opportunity } from '../types/actions'

export type CreateOpportunityInput = components['schemas']['CreateOpportunityDto']
export type AdvanceOpportunityInput = components['schemas']['AdvanceOpportunityDto']
export type CloseOpportunityInput = components['schemas']['CloseOpportunityDto']

export interface OpportunityDetail extends Opportunity {
  events: { id: string; type: string; occurredAt: string; payload: unknown }[]
  deal: Deal | null
}

/** 新建商机（意向阶段） */
export function createOpportunity(dto: CreateOpportunityInput): Promise<Opportunity> {
  return apiPost<Opportunity>('/opportunities', dto)
}

/** 商机列表（客户当前归属可见） */
export function listOpportunities(customerId?: string): Promise<Opportunity[]> {
  return apiGet<Opportunity[]>(`/opportunities${customerId ? `?customerId=${customerId}` : ''}`)
}

/** 商机详情（含事件流与成交 Deal） */
export function getOpportunity(id: string): Promise<OpportunityDetail> {
  return apiGet<OpportunityDetail>(`/opportunities/${id}`)
}

/** 推进 / 转订单（quoteAmount 非空=生成 Deal） */
export function advanceOpportunity(id: string, dto: AdvanceOpportunityInput): Promise<Opportunity> {
  return apiPost<Opportunity>(`/opportunities/${id}/advance`, dto)
}

/** 结案（lost / demand_disappeared） */
export function closeOpportunity(id: string, dto: CloseOpportunityInput): Promise<Opportunity> {
  return apiPost<Opportunity>(`/opportunities/${id}/close`, dto)
}
