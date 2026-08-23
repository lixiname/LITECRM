import type { components } from '@crm/contracts'

export type Role = components['schemas']['Role']

/** 角色展示文案（UI 展示用；能力判定仍以服务端返回的 capabilities 为准，§6.1） */
export const ROLE_LABELS: Record<Role, string> = {
  sales: '销售',
  executive: '经理',
  assistant: '助理',
  admin: '管理员',
}

export const DATA_SCOPE_LABELS = {
  self: '仅本人',
  team: '本团队',
  full: '全部',
} as const
