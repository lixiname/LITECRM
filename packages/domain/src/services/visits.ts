import type { components } from '@crm/contracts'
import { apiGet, apiPatch, apiPost } from './http'
import type { VisitRecord } from '../types/actions'

export type CreateVisitInput = components['schemas']['CreateVisitDto']
export type VisitEntryRules = components['schemas']['VisitEntryRulesDto']
export type UpdateVisitEntryRulesInput = components['schemas']['UpdateVisitEntryRulesDto']

export const DEFAULT_VISIT_ENTRY_RULES: VisitEntryRules = {
  businessSituationMinLength: 0,
  nextActionContentMinLength: 0,
}

export function visitTextLength(value: string): number {
  return Array.from(value.trim()).length
}

/** 双端填报提示；服务端提交时仍独立执行相同规则。 */
export function visitEntryValidationError(
  rules: VisitEntryRules,
  businessSituation: string,
  nextActionContent: string,
): string | undefined {
  const actualLength = visitTextLength(businessSituation)
  if (actualLength < rules.businessSituationMinLength) {
    return `本次情况至少填写 ${rules.businessSituationMinLength} 字（当前 ${actualLength} 字）`
  }
  const nextLength = visitTextLength(nextActionContent)
  if (!nextLength) return '请填写下次拜访内容'
  if (nextLength < rules.nextActionContentMinLength) {
    return `下次拜访内容至少填写 ${rules.nextActionContentMinLength} 字（当前 ${nextLength} 字）`
  }
  return undefined
}

/** 登录人员读取公司拜访填报规则。 */
export function getVisitEntryRules(): Promise<VisitEntryRules> {
  return apiGet<VisitEntryRules>('/visits/rules')
}

/** 管理员更新公司拜访填报规则。 */
export function updateVisitEntryRules(dto: UpdateVisitEntryRulesInput): Promise<VisitEntryRules> {
  return apiPatch<VisitEntryRules>('/visits/rules', dto)
}

/** 登记拜访（§8.4：customer.write） */
export function createVisit(dto: CreateVisitInput): Promise<VisitRecord> {
  return apiPost<VisitRecord>('/visits', dto)
}

/** 客户拜访时间线 */
export function listVisitsByCustomer(customerId: string): Promise<VisitRecord[]> {
  return apiGet<VisitRecord[]>(`/visits/customer/${customerId}`)
}
