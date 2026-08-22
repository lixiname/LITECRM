import { Injectable } from '@nestjs/common'
import { db } from '../common/db/db'
import { users } from '../common/db/schema'
import {
  type Ability,
  type DataScope,
  type Role,
  ROLE_ABILITIES,
  ROLE_DATA_SCOPE,
} from '../common/constants'

export interface Actor {
  id: string
  role: Role
  reportsToId: string | null
}

// 纯函数：team 数据范围 = 本人 + 直属/间接下属（沿 reports_to_id 递归）
// 独立导出便于单测（不连库）
export function computeTeamVisibleIds(
  allUsers: { id: string; reportsToId: string | null }[],
  actorId: string,
): string[] {
  const byManager = new Map<string, string[]>()
  for (const u of allUsers) {
    if (u.reportsToId) {
      const list = byManager.get(u.reportsToId) ?? []
      list.push(u.id)
      byManager.set(u.reportsToId, list)
    }
  }
  const visible = new Set<string>([actorId])
  const stack = [actorId]
  while (stack.length > 0) {
    const cur = stack.pop()!
    for (const child of byManager.get(cur) ?? []) {
      if (!visible.has(child)) {
        visible.add(child)
        stack.push(child)
      }
    }
  }
  return [...visible]
}

@Injectable()
export class AccessService {
  // PDP：能力点判定
  can(role: Role, ability: Ability): boolean {
    return ROLE_ABILITIES[role].includes(ability)
  }

  // PDP：数据范围推导
  getDataScope(role: Role): DataScope {
    return ROLE_DATA_SCOPE[role]
  }

  // PDP：登录权限快照（§8.1：capabilities + dataScope，前端只消费快照）
  buildPermissionSnapshot(role: Role): { capabilities: Ability[]; dataScope: DataScope } {
    return { capabilities: [...ROLE_ABILITIES[role]], dataScope: ROLE_DATA_SCOPE[role] }
  }

  // 组织树：返回 actor 可见的用户 id 集合（self / team / full）
  async getVisibleUserIds(actor: Actor): Promise<string[]> {
    const scope = ROLE_DATA_SCOPE[actor.role]
    if (scope === 'self') return [actor.id]
    const all = await db.select({ id: users.id, reportsToId: users.reportsToId }).from(users)
    if (scope === 'full') return all.map((u) => u.id)
    return computeTeamVisibleIds(all, actor.id)
  }
}
