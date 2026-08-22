import { describe, expect, it } from 'vitest'
import { AccessService, computeTeamVisibleIds } from './access.service'

describe('AccessService 权限语义（§6.1 / §6.2）', () => {
  const service = new AccessService()

  it('数据范围按角色推导', () => {
    expect(service.getDataScope('sales')).toBe('self')
    expect(service.getDataScope('executive')).toBe('team')
    expect(service.getDataScope('assistant')).toBe('full')
    expect(service.getDataScope('admin')).toBe('full')
  })

  it('能力点判定：经营看板仅 executive（方案 A）', () => {
    expect(service.can('executive', 'dashboard.view')).toBe(true)
    expect(service.can('sales', 'dashboard.view')).toBe(false)
    expect(service.can('admin', 'dashboard.view')).toBe(true)
  })

  it('能力点判定：assistant 只读统计，无填报权', () => {
    expect(service.can('assistant', 'stats.view')).toBe(true)
    expect(service.can('assistant', 'customer.write')).toBe(false)
  })

  it('能力点判定：user.manage 仅 admin', () => {
    expect(service.can('admin', 'user.manage')).toBe(true)
    expect(service.can('executive', 'user.manage')).toBe(false)
  })

  it('登录权限快照含 capabilities + dataScope', () => {
    const snap = service.buildPermissionSnapshot('executive')
    expect(snap.dataScope).toBe('team')
    expect(snap.capabilities).toContain('dashboard.view')
    expect(snap.capabilities).toContain('customer.write')
  })
})

describe('computeTeamVisibleIds 组织树推导（纯函数）', () => {
  // 树结构：
  // a(总经理)  -> b(经理) -> d(销售)
  //           -> c(经理) -> e(销售) -> f(销售)
  const all = [
    { id: 'a', reportsToId: null },
    { id: 'b', reportsToId: 'a' },
    { id: 'c', reportsToId: 'a' },
    { id: 'd', reportsToId: 'b' },
    { id: 'e', reportsToId: 'c' },
    { id: 'f', reportsToId: 'e' },
  ]

  it('team 范围 = 本人 + 全部间接下属', () => {
    const ids = computeTeamVisibleIds(all, 'a')
    expect(ids.sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f'])
  })

  it('中层经理只看到自己的子树', () => {
    const ids = computeTeamVisibleIds(all, 'b')
    expect(ids.sort()).toEqual(['b', 'd'])
  })

  it('叶子销售只看到自己', () => {
    const ids = computeTeamVisibleIds(all, 'd')
    expect(ids).toEqual(['d'])
  })

  it('deep 深层下属也包含（f 是 e 的下属）', () => {
    const ids = computeTeamVisibleIds(all, 'c')
    expect(ids.sort()).toEqual(['c', 'e', 'f'])
  })
})
