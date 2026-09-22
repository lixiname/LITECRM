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
    expect(wrapper.text()).toContain('我的工作填报入口安排计划、完成待办与填报记录')
    expect(wrapper.text()).toContain('我的费用查看、提交与作废记录')
    expect(wrapper.text()).toContain('经营驾驶舱常用一屏判断经营状态与介入重点')
    expect(wrapper.text()).toContain('经营分析下钻团队、商机、客户与费用明细')
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
      '我的费用',
    ])
    expect(groups[2]!.text()).not.toContain('我的费用')
    expect(wrapper.findAll('.app-sidebar__menu-item--entry')).toHaveLength(1)
    expect(wrapper.findAll('.app-sidebar__entry-badge')).toHaveLength(1)
    expect(wrapper.findAll('.app-sidebar__frequent')).toHaveLength(1)
  })

  it('助理显示只读经营分析，不显示填报、审批和系统入口', () => {
    const wrapper = mountNavigation(['stats.view', 'export'])
    expect(wrapper.text()).toContain('客户与销售')
    expect(wrapper.text()).toContain('客户经营')
    expect(wrapper.text()).toContain('管理协同')
    expect(wrapper.text()).toContain('经营驾驶舱')
    expect(wrapper.text()).toContain('经营分析')
    expect(wrapper.text()).not.toContain('工作台')
    expect(wrapper.text()).not.toContain('我的工作')
    expect(wrapper.text()).not.toContain('我的费用')
    expect(wrapper.text()).not.toContain('客户接管')
    expect(wrapper.text()).not.toContain('系统设置')
    expect(wrapper.findAll('.app-sidebar__menu-item--entry')).toHaveLength(0)
    expect(wrapper.findAll('.app-sidebar__frequent')).toHaveLength(1)
    expect(wrapper.findAll('.app-sidebar__group-title')[0]!.text()).toBe('管理协同')
  })

  it('销售以工作台为首，不因常用标识获得看板权限', () => {
    const wrapper = mountNavigation(['customer.write'])
    expect(wrapper.findAll('.app-sidebar__group-title').map((group) => group.text())).toEqual([
      '工作台',
      '客户与销售',
    ])
    expect(wrapper.text()).toContain('我的费用')
    expect(wrapper.text()).not.toContain('经营分析')
    expect(wrapper.findAll('.app-sidebar__menu-item--entry')).toHaveLength(1)
    expect(wrapper.findAll('.app-sidebar__entry-badge')).toHaveLength(1)
    expect(wrapper.findAll('.app-sidebar__frequent')).toHaveLength(0)
  })

  it('纯管理可见常用看板，但不显示工作台及个人费用', () => {
    const wrapper = mountNavigation(['dashboard.view'])
    expect(wrapper.text()).toContain('经营驾驶舱常用一屏判断经营状态与介入重点')
    expect(wrapper.text()).toContain('经营分析下钻团队、商机、客户与费用明细')
    expect(wrapper.text()).not.toContain('工作台')
    expect(wrapper.text()).not.toContain('我的费用')
    expect(wrapper.findAll('.app-sidebar__menu-item--entry')).toHaveLength(0)
    expect(wrapper.findAll('.app-sidebar__frequent')).toHaveLength(1)
  })
})
