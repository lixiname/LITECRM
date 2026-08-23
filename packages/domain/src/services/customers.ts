import type { components } from '@crm/contracts'
import { apiDelete, apiGet, apiPatch, apiPost } from './http'
import type {
  Contact,
  CustomerDetail,
  CustomerItem,
  CustomerPage,
  DedupHit,
} from '../types/customer'

export type CreateCustomerInput = components['schemas']['CreateCustomerDto']
export type UpdateCustomerInput = components['schemas']['UpdateCustomerDto']
export type CreateContactInput = components['schemas']['CreateContactDto']
export type DedupCheckInput = components['schemas']['DedupCheckDto']

export interface CustomerListQuery {
  keyword?: string
  city?: string
  industry?: string
  customerType?: string
  level?: string
  status?: string
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

/** 客户详情（含联系人） */
export function getCustomer(id: string): Promise<CustomerDetail> {
  return apiGet<CustomerDetail>(`/customers/${id}`)
}

/** 建档（§8.2 查重硬拦截 409） */
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

// ===== 联系人（§7.2）=====

export function addContact(customerId: string, dto: CreateContactInput): Promise<Contact> {
  return apiPost<Contact>(`/customers/${customerId}/contacts`, dto)
}

export function updateContact(contactId: string, dto: CreateContactInput): Promise<Contact> {
  return apiPatch<Contact>(`/customers/contacts/${contactId}`, dto)
}

export function removeContact(contactId: string): Promise<void> {
  return apiDelete<void>(`/customers/contacts/${contactId}`)
}
