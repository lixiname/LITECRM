import type { components } from '@crm/contracts'
import { apiDelete, apiGet, apiPatch, apiPost } from './http'
import type { DimensionOption } from '../types/customer'

export type CreateDimensionOptionInput = components['schemas']['CreateDimensionOptionDto']
export type UpdateDimensionOptionInput = components['schemas']['UpdateDimensionOptionDto']

// 客户维度配置（§7.2：建档表单下拉；写操作 admin）

/** 某维度全部选项；录入表单须过滤 isActive，详情可解析已停用的历史值 */
export function listDimensionOptions(dimension: string): Promise<DimensionOption[]> {
  return apiGet<DimensionOption[]>(`/catalog/${dimension}`)
}

/** 全部字典项（admin 维护） */
export function listAllOptions(): Promise<DimensionOption[]> {
  return apiGet<DimensionOption[]>('/catalog')
}

export function createOption(dto: CreateDimensionOptionInput): Promise<DimensionOption> {
  return apiPost<DimensionOption>('/catalog', dto)
}

export function updateOption(
  id: string,
  dto: UpdateDimensionOptionInput,
): Promise<DimensionOption> {
  return apiPatch<DimensionOption>(`/catalog/${id}`, dto)
}

export function removeOption(id: string): Promise<void> {
  return apiDelete<void>(`/catalog/${id}`)
}
