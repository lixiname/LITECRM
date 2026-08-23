import { apiGet } from './http'

export interface BusinessWeek {
  id: string
  name: string
  weekStart: string
  weekEnd: string
  isActive: boolean
}

export interface WeeklyPlanItem {
  id: string
  planId: string
  plannedDate: string
  customerId: string | null
  action: string
  notes: string | null
}

export interface WeeklyPlan {
  id: string
  ownerId: string
  businessWeekId: string
  notes: string | null
  items: WeeklyPlanItem[]
}

/** 业务周列表 */
export function listBusinessWeeks(): Promise<BusinessWeek[]> {
  return apiGet<BusinessWeek[]>('/business-weeks')
}

/** 我的周计划（含计划项） */
export function getMyPlan(businessWeekId: string): Promise<WeeklyPlan | null> {
  return apiGet<WeeklyPlan | null>(`/plans?businessWeekId=${businessWeekId}`)
}

/** 我的未读意见 */
export function listUnreadComments(): Promise<
  { id: string; content: string; authorId: string; createdAt: string }[]
> {
  return apiGet('/comments/unread')
}
