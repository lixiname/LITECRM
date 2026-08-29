import { apiGet } from './http'
import type { SalesPlan } from '../types/actions'

export interface ActionWeekView {
  ownerId: string
  overdue: SalesPlan[]
  plans: SalesPlan[]
  businessRecords: WeekBusinessRecord[]
  complaintRecords: WeekComplaintRecord[]
}

export interface WeekBusinessRecord {
  id: string
  type: 'opportunity_created' | 'customer_visit' | 'opportunity_follow_up' | 'opportunity_quote'
  occurredAt: string
  customerId: string
  customerName: string
  opportunityId: string | null
  opportunityName: string | null
  summary: string
  sourcePlanId: string | null
  linkedQuoteId?: string | null
}

export interface WeekComplaintRecord {
  id: string
  type: 'complaint_registered' | 'complaint_follow_up'
  occurredAt: string
  customerId: string
  customerName: string
  complaintId: string
  opportunityName?: null
  summary: string
  sourcePlanId: string | null
}

/** 周览按同一日期范围汇集计划、实际业务记录与客诉记录。 */
export function getWeekView(start: string, end: string, ownerId?: string): Promise<ActionWeekView> {
  const params = new URLSearchParams({ start, end })
  if (ownerId) params.set('ownerId', ownerId)
  return apiGet<ActionWeekView>(`/week-view?${params.toString()}`)
}

/** 本地业务日工具：周视图统一以周一开始，不使用 UTC 截断日期。 */
export function toLocalBusinessDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00`) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isBusinessDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00`)
  return !Number.isNaN(date.getTime()) && toLocalBusinessDate(date) === value
}

export function shiftBusinessDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + days)
  return toLocalBusinessDate(date)
}

export function startOfBusinessWeek(value: string | Date): string {
  const date =
    typeof value === 'string' ? new Date(`${value.slice(0, 10)}T00:00:00`) : new Date(value)
  const weekday = date.getDay() || 7
  date.setDate(date.getDate() - weekday + 1)
  return toLocalBusinessDate(date)
}

export function businessWeekRange(value: string | Date): { monday: string; sunday: string } {
  const monday = startOfBusinessWeek(value)
  return { monday, sunday: shiftBusinessDate(monday, 6) }
}
