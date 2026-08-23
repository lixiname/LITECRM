import type { components } from '@crm/contracts'
import { apiGet, apiPost } from './http'
import type { VisitRecord } from '../types/actions'

export type CreateVisitInput = components['schemas']['CreateVisitDto']

/** 登记拜访（§8.4：customer.write） */
export function createVisit(dto: CreateVisitInput): Promise<VisitRecord> {
  return apiPost<VisitRecord>('/visits', dto)
}

/** 客户拜访时间线 */
export function listVisitsByCustomer(customerId: string): Promise<VisitRecord[]> {
  return apiGet<VisitRecord[]>(`/visits/customer/${customerId}`)
}
