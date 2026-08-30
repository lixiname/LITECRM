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
        <el-menu-item v-for="item in group.items" :key="item.index" :index="item.index">
          <span class="app-sidebar__nav-icon" aria-hidden="true">
            <AppNavIcon :name="item.icon" />
          </span>
          <span class="app-sidebar__nav-copy">
            <strong>{{ item.title }}</strong>
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
  ability?: Ability
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
        description: '计划、待办与每日记录',
        ability: 'customer.write',
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
      {
        index: '/expenses',
        icon: 'expenses',
        title: '费用记录',
        description: '登记并查看个人费用',
        ability: 'customer.write',
      },
    ],
  },
  {
    label: '管理协同',
    items: [
      {
        index: '/management',
        icon: 'management',
        title: '经营分析',
        description: '团队、商机与重点客户',
        ability: 'dashboard.view',
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
    label: '系统设置',
    items: [
      {
        index: '/users',
        icon: 'users',
        title: '用户与组织',
        description: '账号、角色与组织关系',
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
    ],
  },
]

const visibleNavGroups = computed(() =>
  navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !item.ability || auth.hasAbility(item.ability)),
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
.app-sidebar__menu :deep(.el-menu-item.is-active) {
  background: var(--crm-color-primary-light);
  color: var(--crm-color-primary-active);
  box-shadow: none;
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
.app-sidebar__nav-copy {
  min-width: 0;
  margin-left: 9px;
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
