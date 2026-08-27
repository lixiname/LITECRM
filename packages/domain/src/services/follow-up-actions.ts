import type { components } from '@crm/contracts'
import type { SalesPlan } from '../types/actions'
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
): Promise<SalesPlan> {
  return apiPost(`/sales-plans/${id}/reschedule`, { version, plannedAt })
}

export function replaceSalesPlan(
  id: string,
  version: number,
  plannedAt: string,
  content: string,
  reason: string,
): Promise<{ replaced: SalesPlan; replacement: SalesPlan }> {
  return apiPost(`/sales-plans/${id}/replace`, { version, plannedAt, content, reason })
}
