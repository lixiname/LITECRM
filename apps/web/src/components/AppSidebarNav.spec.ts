import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { useAuthStore, type Ability } from '@crm/domain'
import AppSidebarNav from './AppSidebarNav.vue'

const allAbilities: Ability[] = [
  'customer.write',
  'customer.transfer',
  'customer.release',
  'customer.claim',
  'customer.invalidate',
  'customer.restore',
  'customer.import',
  'approve.claim',
  'dashboard.view',
  'stats.view',
  'export',
  'user.manage',
]

function mountNavigation(capabilities: Ability[]) {
  const pinia = createPinia()
  const auth = useAuthStore(pinia)
  auth.$patch({ capabilities })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  return mount(AppSidebarNav, {
    props: { activeMenu: '/customers' },
    global: { plugins: [pinia, router, ElementPlus] },
  })
}

describe('AppSidebarNav', () => {
  it('管理员按工作意图看到完整分组，而非功能平铺', () => {
    const wrapper = mountNavigation(allAbilities)
    expect(wrapper.text()).toContain('工作台')
    expect(wrapper.text()).toContain('客户与销售')
    expect(wrapper.text()).toContain('管理协同')
    expect(wrapper.text()).toContain('系统设置')
    expect(wrapper.text()).toContain('我的工作常用计划、待办与每日记录')
    expect(wrapper.text()).toContain('经营分析常用看板：团队进展与商机概况')
    expect(wrapper.text()).toContain('业务字典业务选项与展示名称')
    expect(wrapper.text()).toContain('分级名额客户等级上限与人员覆盖')
    expect(wrapper.findAll('.app-sidebar__group-title').map((group) => group.text())).toEqual([
      '工作台',
      '管理协同',
      '客户与销售',
      '系统设置',
    ])
    const groups = wrapper.findAll('.el-menu-item-group')
    expect(groups[0]!.findAll('.el-menu-item strong').map((item) => item.text())).toEqual([
      '我的工作',
      '费用记录',
    ])
    expect(groups[0]!.text()).toContain('查看与提交个人费用')
    expect(groups[2]!.text()).not.toContain('费用记录')
    expect(wrapper.findAll('.app-sidebar__frequent')).toHaveLength(2)
  })

  it('助理显示只读经营分析，不显示填报、审批和系统入口', () => {
    const wrapper = mountNavigation(['stats.view', 'export'])
    expect(wrapper.text()).toContain('客户与销售')
    expect(wrapper.text()).toContain('客户经营')
    expect(wrapper.text()).toContain('管理协同')
    expect(wrapper.text()).toContain('经营分析')
    expect(wrapper.text()).not.toContain('工作台')
    expect(wrapper.text()).not.toContain('我的工作')
    expect(wrapper.text()).not.toContain('费用记录')
    expect(wrapper.text()).not.toContain('客户接管')
    expect(wrapper.text()).not.toContain('系统设置')
    expect(wrapper.findAll('.app-sidebar__frequent')).toHaveLength(1)
    expect(wrapper.findAll('.app-sidebar__group-title')[0]!.text()).toBe('管理协同')
  })

  it('销售以工作台为首，不因常用标识获得看板权限', () => {
    const wrapper = mountNavigation(['customer.write'])
    expect(wrapper.findAll('.app-sidebar__group-title').map((group) => group.text())).toEqual([
      '工作台',
      '客户与销售',
    ])
    expect(wrapper.text()).toContain('费用记录')
    expect(wrapper.text()).not.toContain('经营分析')
    expect(wrapper.findAll('.app-sidebar__frequent')).toHaveLength(1)
  })

  it('纯管理可见常用看板，但不显示工作台及费用填报入口', () => {
    const wrapper = mountNavigation(['dashboard.view'])
    expect(wrapper.text()).toContain('经营分析常用看板：团队进展与商机概况')
    expect(wrapper.text()).not.toContain('工作台')
    expect(wrapper.text()).not.toContain('费用记录')
    expect(wrapper.findAll('.app-sidebar__frequent')).toHaveLength(1)
  })
})
