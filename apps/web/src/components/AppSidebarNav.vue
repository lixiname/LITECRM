<template>
  <div class="app-sidebar">
    <div class="app-sidebar__brand">
      <span class="app-sidebar__brand-mark" aria-hidden="true">L</span>
      <span>
        <strong>Lite CRM</strong>
        <small>销售过程管理</small>
      </span>
    </div>

    <el-menu :default-active="activeMenu" router class="app-sidebar__menu">
      <el-menu-item-group v-for="group in visibleNavGroups" :key="group.label">
        <template #title>
          <span class="app-sidebar__group-title">{{ group.label }}</span>
        </template>
        <el-menu-item v-for="item in group.items" :key="item.index" :index="item.index">
          <span class="app-sidebar__nav-icon" aria-hidden="true">{{ item.icon }}</span>
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
        icon: '今',
        title: '我的工作',
        description: '计划、待办与每日记录',
        ability: 'customer.write',
      },
    ],
  },
  {
    label: '客户与销售',
    items: [
      { index: '/customers', icon: '客', title: '客户经营', description: '档案、拜访与客户动态' },
      {
        index: '/opportunities',
        icon: '商',
        title: '商机推进',
        description: '跟进、报价与明确结案',
      },
      { index: '/complaints', icon: '诉', title: '客诉处理', description: '登记、跟进与解决记录' },
      {
        index: '/expenses',
        icon: '费',
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
        icon: '析',
        title: '经营分析',
        description: '团队、商机与重点客户',
        ability: 'dashboard.view',
      },
      {
        index: '/claims',
        icon: '审',
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
        icon: '人',
        title: '用户与组织',
        description: '账号、角色与组织关系',
        ability: 'user.manage',
      },
      {
        index: '/catalog',
        icon: '配',
        title: '业务字典',
        description: '业务选项与展示名称',
        ability: 'user.manage',
      },
      {
        index: '/customer-grade-quotas',
        icon: '级',
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
  gap: 10px;
  padding: 14px 16px 12px;
  border-bottom: 1px solid #eef0f2;
}
.app-sidebar__brand-mark {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 9px;
  background: var(--crm-color-primary);
  color: #fff;
  font-size: 17px;
  font-weight: 700;
  box-shadow: 0 5px 12px rgb(22 119 255 / 22%);
}
.app-sidebar__brand strong,
.app-sidebar__brand small {
  display: block;
}
.app-sidebar__brand strong {
  color: var(--crm-color-text-primary);
  font-size: var(--crm-font-size-md);
  line-height: 20px;
}
.app-sidebar__brand small {
  margin-top: 2px;
  color: var(--crm-color-text-secondary);
  font-size: 11px;
  letter-spacing: 0.08em;
}
.app-sidebar__menu {
  flex: 1;
  padding: 4px 8px 12px;
  border-right: none;
  --el-menu-bg-color: transparent;
}
.app-sidebar__menu :deep(.el-menu-item-group__title) {
  padding: 10px 10px 3px;
  line-height: 16px;
}
.app-sidebar__group-title {
  color: var(--crm-color-text-disabled);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.12em;
}
.app-sidebar__menu :deep(.el-menu-item) {
  height: 48px;
  margin: 1px 0;
  padding: 0 10px !important;
  border-radius: 7px;
  line-height: normal;
  width: auto;
}
.app-sidebar__menu :deep(.el-menu-item.is-active) {
  background: var(--crm-color-primary-light);
  color: var(--crm-color-primary);
  box-shadow: inset 3px 0 0 var(--crm-color-primary);
}
.app-sidebar__menu :deep(.el-menu-item:hover) {
  background: #f5f7fa;
}
.app-sidebar__nav-icon {
  display: inline-flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 8px;
  background: var(--crm-color-bg-page);
  color: var(--crm-color-text-secondary);
  font-size: 13px;
  font-weight: 600;
}
.app-sidebar__menu :deep(.el-menu-item.is-active) .app-sidebar__nav-icon {
  background: var(--crm-color-primary);
  color: #fff;
}
.app-sidebar__nav-copy {
  min-width: 0;
  margin-left: 10px;
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
  font-size: 14px;
  font-weight: 600;
  line-height: 17px;
}
.app-sidebar__nav-copy small {
  margin-top: 2px;
  color: var(--crm-color-text-secondary);
  font-size: 11px;
  line-height: 14px;
}
.app-sidebar__menu :deep(.el-menu-item.is-active) .app-sidebar__nav-copy strong {
  color: var(--crm-color-primary);
}
</style>
