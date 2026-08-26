import { apiGet } from './http'
import type { FollowUpAction } from '../types/actions'

export interface ActionWeekView {
  overdue: FollowUpAction[]
  actions: FollowUpAction[]
}

/** 周览只读取统一行动源，并单列早于当前范围的未完成行动。 */
export function getWeekView(start: string, end: string): Promise<ActionWeekView> {
  return apiGet<ActionWeekView>(`/week-view?start=${start}&end=${end}`)
}
