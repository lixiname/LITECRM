import { apiGet, apiPost } from './http'
import type { ClaimListItem } from '../types/customer'

// 接管审批流（§8.3）

/** 发起接管申请（customer.transfer） */
export function createClaim(customerId: string, reason: string) {
  return apiPost<{ id: string; status: string }>(`/claims/customer/${customerId}`, { reason })
}

/** 待审批列表（approve.claim：executive/admin） */
export function listPendingClaims(): Promise<ClaimListItem[]> {
  return apiGet<ClaimListItem[]>('/claims')
}

/** 审批通过（approve.claim） */
export function approveClaim(id: string, comment?: string) {
  return apiPost<{ id: string; status: string }>(
    `/claims/${id}/approve`,
    comment ? { comment } : {},
  )
}

/** 拒绝（意见必填） */
export function rejectClaim(id: string, comment: string) {
  return apiPost<{ id: string; status: string }>(`/claims/${id}/reject`, { comment })
}

/** 撤回（申请人本人） */
export function withdrawClaim(id: string) {
  return apiPost<{ id: string; status: string }>(`/claims/${id}/withdraw`)
}
