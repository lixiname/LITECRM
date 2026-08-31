import { ForbiddenException, Injectable } from '@nestjs/common'
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
  async getVisibleUserIds(actor: { id: string; role: Role }): Promise<string[]> {
    const scope = ROLE_DATA_SCOPE[actor.role]
    if (scope === 'self') return [actor.id]
    const all = await db
      .select({ id: users.id, role: users.role, reportsToId: users.reportsToId })
      .from(users)
    if (scope === 'full') {
      // admin 的 full 是全部账号；assistant 的 full 是全部销售经营人员。
      // 不按 isActive 过滤，确保离职/停用销售名下的历史经营数据仍可查询。
      if (actor.role === 'assistant') {
        return all.filter((u) => u.role === 'sales' || u.role === 'executive').map((u) => u.id)
      }
      return all.map((u) => u.id)
    }
    return computeTeamVisibleIds(all, actor.id)
  }

  /** 将可选人员筛选收口到组织树权限；未指定时默认本人，避免管理者个人页面混入整支团队。 */
  async resolveVisibleUserId(
    actor: { id: string; role: Role },
    requestedUserId?: string,
  ): Promise<string> {
    const targetUserId = requestedUserId ?? actor.id
    const visible = await this.getVisibleUserIds(actor)
    if (!visible.includes(targetUserId)) throw new ForbiddenException('无权查看该人员数据')
    return targetUserId
  }

  // 管理链判定：actor 是否是 targetUserId 的上级（沿 reports_to_id 上溯，§8.3 assertCanContribute）
  // 权限基础设施，业务服务禁止自行遍历组织树（§6.3 约束）
  async isManagerOf(actorId: string, targetUserId: string | null): Promise<boolean> {
    if (!targetUserId || actorId === targetUserId) return false
    const all = await db.select({ id: users.id, reportsToId: users.reportsToId }).from(users)
    const byId = new Map(all.map((u) => [u.id, u.reportsToId]))

    let cur: string | null = targetUserId
    const seen = new Set<string>()
    while (cur) {
      if (cur === actorId) return true
      if (seen.has(cur)) break // 环保护
      seen.add(cur)
      cur = byId.get(cur) ?? null
    }
    return false
  }

  // 客户可维护判定（§8.3/8.4/8.5/8.6）：owner / 管理链 / admin；业务模块统一走此收口
  async assertCanContributeCustomer(
    customerOwnerId: string | null,
    actor: { id: string; role: Role },
  ): Promise<void> {
    if (customerOwnerId === actor.id) return
    if (actor.role === 'admin') return
    const isManager = await this.isManagerOf(actor.id, customerOwnerId)
    if (isManager) return
    throw new ForbiddenException('无权维护该客户')
  }
}
