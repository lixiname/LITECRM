import { apiGet } from './http'
import type { SalesPlan } from '../types/actions'

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
  actions: SalesPlan[]
}

/** 业务周列表 */
export function listBusinessWeeks(): Promise<BusinessWeek[]> {
  return apiGet<BusinessWeek[]>('/business-weeks')
}

/** 我的周计划摘要及该周行动。 */
export function getMyPlan(
  businessWeekId: string,
): Promise<WeeklyPlan | { plan: null; actions: SalesPlan[] }> {
  return apiGet(`/plans?businessWeekId=${businessWeekId}`)
}

/** 周览点空白加计划（§2.4 日历式）：按日期自动定位业务周 + 确保周计划 */
