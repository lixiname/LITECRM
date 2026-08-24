import { apiGet } from './http'

// 周览聚合（交互设计打磨 §2 个人日程）：计划项 / 拜访 / 商机跟进 / 客诉跟进，按天分组
export type WeekViewItemType = 'plan' | 'visit' | 'opportunity' | 'complaint'

export interface WeekViewItem {
  type: WeekViewItemType
  id: string
  summary: string
  customerId: string | null
  overdue: boolean // 跟进已逾期（商机/客诉）
}

export interface DayBlock {
  date: string // YYYY-MM-DD
  items: WeekViewItem[]
}

/** 周览聚合：?start=YYYY-MM-DD&end=YYYY-MM-DD */
export function getWeekView(start: string, end: string): Promise<DayBlock[]> {
  return apiGet<DayBlock[]>(`/week-view?start=${start}&end=${end}`)
}
