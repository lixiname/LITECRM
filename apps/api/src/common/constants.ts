// 权限基础设施：角色、能力点、数据范围（规格 §6.1 / §6.2）
// 混合访问控制：RBAC 管操作（能力点）× 组织树管数据范围，服务端唯一裁决

export const ROLES = ['sales', 'executive', 'assistant', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const DATA_SCOPES = ['self', 'team', 'full'] as const
export type DataScope = (typeof DATA_SCOPES)[number]

// 能力点 = 操作维度（RBAC）
export const ABILITIES = [
  'customer.write', // 基础填报：拜访/商机/客诉
  'customer.transfer', // 客户移交/接管申请
  'approve.claim', // 接管审批
  'dashboard.view', // 经营看板（漏斗/储备/转化，方案 A 专属 executive）
  'stats.view', // 全量统计（只读）
  'export', // 导出
  'user.manage', // 系统配置/用户管理
] as const
export type Ability = (typeof ABILITIES)[number]

// 角色 → 能力点（规格 §6.2 表格）
export const ROLE_ABILITIES: Record<Role, readonly Ability[]> = {
  sales: ['customer.write', 'customer.transfer'],
  executive: ['customer.write', 'customer.transfer', 'approve.claim', 'dashboard.view'],
  assistant: ['stats.view', 'export'],
  admin: [...ABILITIES],
}

// 角色 → 数据范围（组织树自动推导；admin/assistant 短路为 full，§6.1）
export const ROLE_DATA_SCOPE: Record<Role, DataScope> = {
  sales: 'self',
  executive: 'team',
  assistant: 'full',
  admin: 'full',
}
