import type { components } from '@crm/contracts'
import { apiGet, apiPost } from './http'
import type { Complaint, FollowUpAction } from '../types/actions'

export type CreateComplaintInput = components['schemas']['CreateComplaintDto']
export type FollowUpComplaintInput = components['schemas']['FollowUpComplaintDto']

export interface ComplaintDetail extends Complaint {
  followUps: {
    id: string
    content: string
    outcome: string
    resolution: string | null
    occurredAt: string
  }[]
  actions: FollowUpAction[]
}

/** 登记客诉（§8.6） */
export function createComplaint(dto: CreateComplaintInput): Promise<Complaint> {
  return apiPost<Complaint>('/complaints', dto)
}

/** 客诉列表 */
export function listComplaints(customerId?: string): Promise<Complaint[]> {
  return apiGet<Complaint[]>(`/complaints${customerId ? `?customerId=${customerId}` : ''}`)
}

/** 客诉详情（含跟进事件） */
export function getComplaint(id: string): Promise<ComplaintDetail> {
  return apiGet<ComplaintDetail>(`/complaints/${id}`)
}

/** 跟进 / 确认解决 */
export function followUpComplaint(id: string, dto: FollowUpComplaintInput): Promise<Complaint> {
  return apiPost<Complaint>(`/complaints/${id}/follow-up`, dto)
}
