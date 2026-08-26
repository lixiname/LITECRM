import type { components } from '@crm/contracts'
import type { FollowUpAction } from '../types/actions'
import { apiPost } from './http'

export type CreateFollowUpActionInput = components['schemas']['CreateFollowUpActionDto']

export function createFollowUpAction(dto: CreateFollowUpActionInput): Promise<FollowUpAction> {
  return apiPost('/actions', dto)
}

export function completeFollowUpAction(id: string, version: number): Promise<FollowUpAction> {
  return apiPost(`/actions/${id}/complete`, { version })
}

export function rescheduleFollowUpAction(
  id: string,
  version: number,
  plannedAt: string,
): Promise<FollowUpAction> {
  return apiPost(`/actions/${id}/reschedule`, { version, plannedAt })
}

export function cancelFollowUpAction(
  id: string,
  version: number,
  reason: string,
): Promise<FollowUpAction> {
  return apiPost(`/actions/${id}/cancel`, { version, reason })
}
