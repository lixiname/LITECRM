import type { components } from '@crm/contracts'
import { apiGet, apiPatch, apiPut } from './http'

export type GradeQuotaOverview = components['schemas']['GradeQuotaOverviewDto']
export type UserGradeQuotaSummary = components['schemas']['UserGradeQuotaSummaryDto']
export type UserGradeQuota = components['schemas']['UserGradeQuotaDto']
export type UpdateGradeQuotaDefaultsInput = components['schemas']['UpdateGradeQuotaDefaultsDto']
export type UpdateUserGradeQuotasInput = components['schemas']['UpdateUserGradeQuotasDto']
export type CustomerGradeQuotaMode = components['schemas']['CustomerGradeQuotaMode']

export function getGradeQuotaOverview(): Promise<GradeQuotaOverview> {
  return apiGet<GradeQuotaOverview>('/customer-grade-quotas')
}

export function updateGradeQuotaDefaults(
  dto: UpdateGradeQuotaDefaultsInput,
): Promise<GradeQuotaOverview> {
  return apiPatch<GradeQuotaOverview>('/customer-grade-quotas/defaults', dto)
}

export function updateUserGradeQuotas(
  userId: string,
  dto: UpdateUserGradeQuotasInput,
): Promise<GradeQuotaOverview> {
  return apiPut<GradeQuotaOverview>(`/customer-grade-quotas/users/${userId}`, dto)
}
