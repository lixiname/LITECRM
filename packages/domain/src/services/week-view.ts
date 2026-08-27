import { apiGet } from './http'
import type { SalesPlan } from '../types/actions'

export interface ActionWeekView {
  overdue: SalesPlan[]
  plans: SalesPlan[]
  businessRecords: WeekBusinessRecord[]
  complaintRecords: WeekComplaintRecord[]
}

export interface WeekBusinessRecord {
  id: string
  type: 'customer_visit' | 'opportunity_follow_up' | 'opportunity_quote'
  occurredAt: string
  customerId: string
  customerName: string
  opportunityId: string | null
  opportunityName: string | null
  summary: string
  sourcePlanId: string | null
}

export interface WeekComplaintRecord {
  id: string
  type: 'complaint_registered' | 'complaint_follow_up'
  occurredAt: string
  customerId: string
  customerName: string
  complaintId: string
  summary: string
  sourcePlanId: string | null
}

/** 周览按同一日期范围汇集计划、实际业务记录与客诉记录。 */
export function getWeekView(start: string, end: string): Promise<ActionWeekView> {
  return apiGet<ActionWeekView>(`/week-view?start=${start}&end=${end}`)
}
