import type { components } from '@crm/contracts'
import { apiDelete, apiGet, apiGetBlob, apiPatch, apiPost, apiPostForm } from './http'
import type {
  Contact,
  CustomerDetail,
  CustomerItem,
  CustomerPage,
  CustomerRelationshipStage,
  DedupHit,
} from '../types/customer'

export type CreateCustomerInput = components['schemas']['CreateCustomerDto']
export type UpdateCustomerInput = components['schemas']['UpdateCustomerDto']
export type CreateContactInput = components['schemas']['CreateContactDto']
export type UpdateContactInput = components['schemas']['UpdateContactDto']
export type DedupCheckInput = components['schemas']['DedupCheckDto']
export type AssigneeOption = components['schemas']['AssigneeOptionDto']

export const CUSTOMER_IMPORT_FIELD_OPTIONS = [
  { value: 'name', label: '客户名称', required: true },
  { value: 'customerCode', label: 'ERP 客户编码' },
  { value: 'unifiedSocialCreditCode', label: '统一社会信用代码' },
  { value: 'province', label: '省份' },
  { value: 'city', label: '城市' },
  { value: 'address', label: '详细地址' },
  { value: 'industry', label: '客户行业' },
  { value: 'subIndustry', label: '具体领域' },
  { value: 'customerType', label: '客户类型' },
  { value: 'source', label: '客户来源' },
  { value: 'grade', label: '客户等级' },
  { value: 'ownerUsername', label: '负责人账号/姓名' },
  { value: 'contactName', label: '联系人' },
  { value: 'contactPhone', label: '联系电话' },
  { value: 'preCrmDealConfirmed', label: '是否存量客户' },
  { value: 'preCrmSalesAmount', label: 'CRM 前累计成交金额' },
  { value: 'notes', label: '备注' },
] as const

export type CustomerImportField = (typeof CUSTOMER_IMPORT_FIELD_OPTIONS)[number]['value']
export type CustomerImportMapping = Partial<Record<CustomerImportField, string>>

export interface CustomerImportUploadResult {
  id: string
  fileName: string
  headers: string[]
  suggestedMapping: CustomerImportMapping
  sampleRows: { rowNumber: number; rawData: Record<string, string | number | boolean | null> }[]
  totalRows: number
}

export interface CustomerImportPreviewInput {
  mapping: CustomerImportMapping
  defaultRelationship: 'pre_crm_existing' | 'prospect' | 'per_row'
  targetStatus: 'active' | 'public'
  defaultOwnerId?: string
  dataCutoffOn?: string
}

export interface CustomerImportPreviewRow {
  rowNumber: number
  status: 'ready' | 'duplicate' | 'invalid'
  error?: string | null
  data?: { name?: string; customerCode?: string | null; ownerId?: string | null }
}

export interface CustomerImportPreviewResult {
  batchId: string
  totalRows: number
  readyRows: number
  duplicateRows: number
  failedRows: number
  rows: CustomerImportPreviewRow[]
}

export interface CustomerImportCommitResult {
  batchId: string
  importedRows: number
  skippedRows: number
  failedRows: number
}

export interface CustomerListQuery {
  keyword?: string
  city?: string
  industry?: string
  customerType?: string
  grade?: string
  status?: string
  relationshipStage?: CustomerRelationshipStage
  page?: number
  pageSize?: number
}

/** 客户列表（§7.3 数据范围过滤 + 五级检索 + 分页） */
export function listCustomers(query: CustomerListQuery = {}): Promise<CustomerPage> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return apiGet<CustomerPage>(`/customers${qs ? `?${qs}` : ''}`)
}

/** 客户详情（含联系人、商机摘要、成交摘要、活动时间线） */
export function getCustomer(id: string): Promise<CustomerDetail> {
  return apiGet<CustomerDetail>(`/customers/${id}`)
}

/** 客户移交选择器：只返回可承担客户归属的 active 用户。 */
export function listCustomerAssignees(): Promise<AssigneeOption[]> {
  return apiGet<AssigneeOption[]>('/customers/assignees')
}

export function downloadCustomerImportTemplate(): Promise<Blob> {
  return apiGetBlob('/customers/imports/template')
}

export function uploadCustomerImport(file: File): Promise<CustomerImportUploadResult> {
  const form = new FormData()
  form.append('file', file)
  return apiPostForm<CustomerImportUploadResult>('/customers/imports', form)
}

export function previewCustomerImport(
  batchId: string,
  input: CustomerImportPreviewInput,
): Promise<CustomerImportPreviewResult> {
  return apiPost<CustomerImportPreviewResult>(`/customers/imports/${batchId}/preview`, input)
}

export function commitCustomerImport(batchId: string): Promise<CustomerImportCommitResult> {
  return apiPost<CustomerImportCommitResult>(`/customers/imports/${batchId}/commit`)
}

/** 建档：名称疑似重复只提示，ERP 编码/信用代码冲突才硬拦截。 */
export function createCustomer(dto: CreateCustomerInput): Promise<CustomerItem> {
  return apiPost<CustomerItem>('/customers', dto)
}

export function updateCustomer(id: string, dto: UpdateCustomerInput): Promise<CustomerItem> {
  return apiPatch<CustomerItem>(`/customers/${id}`, dto)
}

/** 查重预检（§8.2 置信度分级） */
export function checkDuplicate(dto: DedupCheckInput): Promise<DedupHit[]> {
  return apiPost<DedupHit[]>('/customers/dedup-check', dto)
}

/** 所有权转移（§8.3） */
export function transferCustomer(
  id: string,
  dto: components['schemas']['TransferCustomerDto'],
): Promise<{ id: string; ownerId: string }> {
  return apiPost(`/customers/${id}/transfer`, dto)
}

/** 主动释放（§8.3：pool 公海 / invalid 无效） */
export function releaseCustomer(
  id: string,
  dto: components['schemas']['ReleaseCustomerDto'],
): Promise<{ id: string; status: string; ownerId: string | null }> {
  return apiPost(`/customers/${id}/release`, dto)
}

/** 公海认领（§8.3） */
export function claimCustomer(
  id: string,
): Promise<{ id: string; status: string; ownerId: string }> {
  return apiPost(`/customers/${id}/claim`)
}

/** 恢复无效客户：区域负责人/管理员重新指定负责人。 */
export function restoreCustomer(
  id: string,
  dto: { toOwnerId: string; reason: string },
): Promise<{ id: string; status: string; ownerId: string }> {
  return apiPost(`/customers/${id}/restore`, dto)
}

// ===== 联系人（§7.2）=====

export function addContact(customerId: string, dto: CreateContactInput): Promise<Contact> {
  return apiPost<Contact>(`/customers/${customerId}/contacts`, dto)
}

export function updateContact(contactId: string, dto: UpdateContactInput): Promise<Contact> {
  return apiPatch<Contact>(`/customers/contacts/${contactId}`, dto)
}

export function removeContact(contactId: string, version: number): Promise<void> {
  return apiDelete<void>(`/customers/contacts/${contactId}?version=${version}`)
}
