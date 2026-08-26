import { apiGet, apiPost } from './http'
import type { FollowUpAction } from '../types/actions'

export interface BusinessWeek {
  id: string
  name: string
  weekStart: string
  weekEnd: string
  isActive: boolean
}

export interface WeeklyPlan {
  id: string
  ownerId: string
  businessWeekId: string
  summary: string | null
  actions: FollowUpAction[]
}

/** 业务周列表 */
export function listBusinessWeeks(): Promise<BusinessWeek[]> {
  return apiGet<BusinessWeek[]>('/business-weeks')
}

/** 我的周计划摘要及该周行动。 */
export function getMyPlan(
  businessWeekId: string,
): Promise<WeeklyPlan | { plan: null; actions: FollowUpAction[] }> {
  return apiGet(`/plans?businessWeekId=${businessWeekId}`)
}

/** 周览点空白加计划（§2.4 日历式）：按日期自动定位业务周 + 确保周计划 */
export function createPlanItemByDate(dto: {
  plannedDate: string
  action: string
  customerId?: string
  notes?: string
}): Promise<FollowUpAction> {
  return apiPost<FollowUpAction>('/plans/items-by-date', dto)
}

/** 我的未读意见 */
export function listUnreadComments(): Promise<
  { id: string; content: string; authorId: string; createdAt: string }[]
> {
  return apiGet('/comments/unread')
}
