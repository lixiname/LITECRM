import type { components } from '@crm/contracts'
import { apiGet, apiPost } from './http'
import type { Complaint, FollowUpAction } from '../types/actions'

export type CreateComplaintInput = components['schemas']['CreateComplaintDto']
export type FollowUpComplaintInput = components['schemas']['FollowUpComplaintDto']

export type ComplaintTimelineType = 'registered' | 'follow_up' | 'pending_action' | 'resolved'
export type ComplaintTimelineStatus = 'completed' | 'pending' | 'overdue' | 'resolved'

export interface ComplaintTimelineItem {
  id: string
  type: ComplaintTimelineType
  timestamp: string
  title: string
  content: string
  actorName: string | null
  status: ComplaintTimelineStatus
  outcome?: string
}

export interface ComplaintDetail extends Complaint {
  customerName: string
  currentOwnerId: string | null
  followUps: {
    id: string
    content: string
    outcome: string
    resolution: string | null
    occurredAt: string
  }[]
  actions: FollowUpAction[]
  timeline: ComplaintTimelineItem[]
}

export interface ComplaintPage {
  items: Complaint[]
  total: number
  page: number
  pageSize: number
}

export interface ComplaintListQuery {
  keyword?: string
  customerId?: string
  status?: 'registered' | 'resolved'
  overdue?: boolean
  page?: number
  pageSize?: number
}

/** 登记客诉（§8.6） */
export function createComplaint(dto: CreateComplaintInput): Promise<Complaint> {
  return apiPost<Complaint>('/complaints', dto)
}

/** 客诉分页工作台；列表只返回摘要与当前行动。 */
export function listComplaints(query: ComplaintListQuery = {}): Promise<ComplaintPage> {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const search = params.toString()
  return apiGet<ComplaintPage>(`/complaints${search ? `?${search}` : ''}`)
}

/** 客诉详情（含登记、处理、当前行动和解决终点的统一生命周期时间线） */
export function getComplaint(id: string): Promise<ComplaintDetail> {
  return apiGet<ComplaintDetail>(`/complaints/${id}`)
}

/** 跟进 / 确认解决 */
export function followUpComplaint(id: string, dto: FollowUpComplaintInput): Promise<Complaint> {
  return apiPost<Complaint>(`/complaints/${id}/follow-up`, dto)
}
