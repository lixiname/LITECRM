import type { components } from '@crm/contracts'
import type { SalesPlan, SalesPlanComment } from '../types/actions'
import { apiGet, apiPost } from './http'

export type CreateSalesPlanInput = components['schemas']['CreateSalesPlanDto']

export function createSalesPlan(dto: CreateSalesPlanInput): Promise<SalesPlan> {
  return apiPost('/sales-plans', dto)
}

export function getSalesPlan(id: string): Promise<SalesPlan> {
  return apiGet(`/sales-plans/${id}`)
}

export function rescheduleSalesPlan(
  id: string,
  version: number,
  plannedAt: string,
  reason: string,
): Promise<SalesPlan> {
  return apiPost(`/sales-plans/${id}/reschedule`, { version, plannedAt, reason })
}

export interface SalesPlanReschedule {
  id: string
  salesPlanId: string
  fromPlannedAt: string
  toPlannedAt: string
  fromContent: string | null
  toContent: string | null
  reason: string
  changedById: string
  changedByName: string
  occurredAt: string
}

export function getSalesPlanReschedules(id: string): Promise<SalesPlanReschedule[]> {
  return apiGet(`/sales-plans/${id}/reschedules`)
}

export function listSalesPlanComments(id: string): Promise<SalesPlanComment[]> {
  return apiGet(`/sales-plans/${id}/comments`)
}

export function createSalesPlanComment(id: string, content: string): Promise<SalesPlanComment> {
  return apiPost(`/sales-plans/${id}/comments`, { content })
}

export function markSalesPlanCommentsRead(id: string): Promise<{ readCount: number }> {
  return apiPost(`/sales-plans/${id}/comments/read`, {})
}
