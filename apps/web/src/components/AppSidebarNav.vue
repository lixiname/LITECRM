<template>
  <div class="app-sidebar">
    <div class="app-sidebar__brand">
      <span class="app-sidebar__brand-mark" aria-hidden="true">L</span>
      <span>
        <strong>LITECRM</strong>
        <small>INDUSTRIAL SALES</small>
      </span>
    </div>

    <el-menu :default-active="activeMenu" router class="app-sidebar__menu">
      <el-menu-item-group v-for="group in visibleNavGroups" :key="group.label">
        <template #title>
          <span class="app-sidebar__group-title">{{ group.label }}</span>
        </template>
        <el-menu-item
          v-for="item in group.items"
          :key="item.index"
          :index="item.index"
          :class="{ 'app-sidebar__menu-item--entry': item.primaryEntry }"
        >
          <span class="app-sidebar__nav-icon" aria-hidden="true">
            <AppNavIcon :name="item.icon" />
          </span>
          <span class="app-sidebar__nav-copy">
            <span class="app-sidebar__nav-heading">
              <strong>{{ item.title }}</strong>
              <span v-if="item.primaryEntry" class="app-sidebar__entry-badge">填报入口</span>
              <span v-else-if="item.frequent" class="app-sidebar__frequent">常用</span>
            </span>
            <small>{{ item.description }}</small>
          </span>
        </el-menu-item>
      </el-menu-item-group>
    </el-menu>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useAuthStore, type Ability } from '@crm/domain'
import AppNavIcon from './AppNavIcon.vue'

defineProps<{ activeMenu: string }>()

const auth = useAuthStore()

interface NavItem {
  index: string
  icon: string
  title: string
  description: string
  primaryEntry?: boolean
  frequent?: boolean
  ability?: Ability
  anyAbility?: Ability[]
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    label: '工作台',
    items: [
      {
        index: '/week-view',
        icon: 'work',
        title: '我的工作',
        description: '安排计划、完成待办与填报记录',
        primaryEntry: true,
        ability: 'customer.write',
      },
      {
        index: '/expenses',
        icon: 'expenses',
        title: '我的费用',
        description: '查看、提交与作废记录',
        ability: 'customer.write',
      },
    ],
  },
  {
    label: '管理协同',
    items: [
      {
        index: '/cockpit',
        icon: 'cockpit',
        title: '经营驾驶舱',
        description: '一屏判断经营状态与介入重点',
        frequent: true,
        anyAbility: ['dashboard.view', 'stats.view'],
      },
      {
        index: '/management',
        icon: 'management',
        title: '经营分析',
        description: '下钻团队、商机、客户与费用明细',
        anyAbility: ['dashboard.view', 'stats.view'],
      },
      {
        index: '/claims',
        icon: 'claims',
        title: '客户接管',
        description: '处理客户归属申请',
        ability: 'approve.claim',
      },
    ],
  },
  {
    label: '客户与销售',
    items: [
      {
        index: '/customers',
        icon: 'customers',
        title: '客户经营',
        description: '档案、拜访与客户动态',
      },
      {
        index: '/opportunities',
        icon: 'opportunities',
        title: '商机推进',
        description: '跟进、报价与明确结案',
      },
      {
        index: '/complaints',
        icon: 'complaints',
        title: '客诉处理',
        description: '登记、跟进与解决记录',
      },
    ],
  },
  {
    label: '系统设置',
    items: [
      {
        index: '/users',
        icon: 'users',
        title: '用户与组织',
        description: '账号、职位与组织关系',
        ability: 'user.manage',
      },
      {
        index: '/catalog',
        icon: 'catalog',
        title: '业务字典',
        description: '业务选项与展示名称',
        ability: 'user.manage',
      },
      {
        index: '/customer-grade-quotas',
        icon: 'quotas',
        title: '分级名额',
        description: '客户等级上限与人员覆盖',
        ability: 'user.manage',
      },
      {
        index: '/visit-entry-rules',
        icon: 'catalog',
        title: '拜访填报规则',
        description: '本次与下次内容字数下限',
        ability: 'user.manage',
      },
    ],
  },
]

const visibleNavGroups = computed(() =>
  navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.ability || auth.hasAbility(item.ability)) &&
          (!item.anyAbility || auth.hasAnyAbility(item.anyAbility)),
      ),
    }))
    .filter((group) => group.items.length > 0),
)
</script>

<style scoped>
.app-sidebar {
  display: flex;
  min-height: 100%;
  flex-direction: column;
}
.app-sidebar__brand {
  display: flex;
  align-items: center;
  min-height: var(--crm-header-height);
  gap: 11px;
  padding: 0 20px;
  border-bottom: 1px solid var(--crm-color-divider);
}
.app-sidebar__brand-mark {
  display: inline-flex;
  width: 31px;
  height: 31px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 8px;
  background: var(--crm-color-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
  box-shadow: 0 6px 14px rgb(57 115 97 / 17%);
}
.app-sidebar__brand strong,
.app-sidebar__brand small {
  display: block;
}
.app-sidebar__brand strong {
  color: var(--crm-color-text-primary);
  font-size: 15px;
  line-height: 18px;
  letter-spacing: 0.02em;
}
.app-sidebar__brand small {
  margin-top: 3px;
  color: var(--crm-color-text-tertiary);
  font-size: 9px;
  letter-spacing: 0.13em;
}
.app-sidebar__menu {
  flex: 1;
  padding: 10px 12px 16px;
  border-right: none;
  --el-menu-bg-color: transparent;
}
.app-sidebar__menu :deep(.el-menu-item-group__title) {
  padding: 12px 9px 5px;
  line-height: 16px;
}
.app-sidebar__group-title {
  color: var(--crm-color-text-tertiary);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.15em;
}
.app-sidebar__menu :deep(.el-menu-item) {
  position: relative;
  height: 46px;
  margin: 2px 0;
  padding: 0 10px !important;
  border-radius: 8px;
  line-height: normal;
  width: auto;
}
.app-sidebar__menu :deep(.el-menu-item.app-sidebar__menu-item--entry) {
  border: 1px solid var(--crm-color-primary-light);
  background: var(--crm-color-primary-lighter);
}
.app-sidebar__menu :deep(.el-menu-item.app-sidebar__menu-item--entry:hover) {
  border-color: var(--crm-color-primary-light);
  background: var(--crm-color-primary-light);
}
.app-sidebar__menu :deep(.el-menu-item.is-active) {
  background: var(--crm-color-primary-light);
  color: var(--crm-color-primary-active);
  box-shadow: none;
}
.app-sidebar__menu :deep(.el-menu-item.app-sidebar__menu-item--entry.is-active) {
  border-color: var(--crm-color-primary);
  background: var(--crm-color-primary-light);
  box-shadow: var(--crm-shadow-focus);
}
.app-sidebar__menu :deep(.el-menu-item.is-active)::before {
  position: absolute;
  top: 13px;
  bottom: 13px;
  left: 7px;
  width: 3px;
  border-radius: 3px;
  background: var(--crm-color-primary);
  content: '';
}
.app-sidebar__menu :deep(.el-menu-item:hover) {
  background: var(--crm-color-bg-soft);
}
.app-sidebar__nav-icon {
  display: inline-flex;
  width: 23px;
  height: 28px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  color: var(--crm-color-text-secondary);
}
.app-sidebar__menu :deep(.el-menu-item.is-active) .app-sidebar__nav-icon {
  color: var(--crm-color-primary-active);
}
.app-sidebar__menu :deep(.el-menu-item.app-sidebar__menu-item--entry) .app-sidebar__nav-icon {
  color: var(--crm-color-primary-active);
}
.app-sidebar__nav-copy {
  flex: 1;
  min-width: 0;
  margin-left: 9px;
}
.app-sidebar__nav-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.app-sidebar__frequent {
  flex: 0 0 auto;
  padding: 0 5px;
  border: 1px solid var(--crm-color-border);
  border-radius: 4px;
  color: var(--crm-color-text-secondary);
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}
.app-sidebar__entry-badge {
  flex: 0 0 auto;
  padding: 0 5px;
  border-radius: 4px;
  background: var(--crm-color-primary);
  color: #fff;
  font-size: 9px;
  font-weight: 700;
  line-height: 16px;
  letter-spacing: 0.02em;
}
.app-sidebar__nav-copy strong,
.app-sidebar__nav-copy small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.app-sidebar__nav-copy strong {
  color: var(--crm-color-text-primary);
  font-size: 13px;
  font-weight: 620;
  line-height: 16px;
}
.app-sidebar__menu
  :deep(.el-menu-item.app-sidebar__menu-item--entry)
  .app-sidebar__nav-copy
  strong {
  color: var(--crm-color-primary-active);
  font-weight: 700;
}
.app-sidebar__nav-copy small {
  margin-top: 2px;
  color: var(--crm-color-text-tertiary);
  font-size: 10px;
  line-height: 13px;
}
.app-sidebar__menu :deep(.el-menu-item.is-active) .app-sidebar__nav-copy strong {
  color: var(--crm-color-primary-active);
}
</style>
