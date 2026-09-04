<template>
  <el-container class="app-layout">
    <el-aside width="236px" class="app-layout__aside">
      <AppSidebarNav :active-menu="activeMenu" />
    </el-aside>

    <el-container>
      <el-header class="app-layout__header">
        <div class="app-layout__context">
          <span>{{ sectionLabel }}</span>
          <i>/</i>
          <strong>{{ route.meta.title ?? '' }}</strong>
        </div>
        <div class="app-layout__user">
          <span class="app-layout__avatar" aria-hidden="true">{{ userInitial }}</span>
          <span class="app-layout__identity">
            <strong>{{ auth.user?.displayName }}</strong>
            <small>{{ auth.user?.jobTitle ?? '职位未设置' }}</small>
          </span>
          <el-button link class="app-layout__logout" @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="app-layout__main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@crm/domain'
import AppSidebarNav from './AppSidebarNav.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// 侧边栏激活项：取一级路径（/customers/:id → /customers）
const activeMenu = computed(() => `/${route.path.split('/')[1] ?? ''}`)
const sectionLabel = computed(() => {
  if (['/week-view', '/expenses'].includes(activeMenu.value)) return '工作台'
  if (['/customers', '/opportunities', '/complaints'].includes(activeMenu.value)) {
    return '客户与销售'
  }
  if (['/management', '/claims'].includes(activeMenu.value)) return '管理协同'
  return '系统设置'
})
const userInitial = computed(() => auth.user?.displayName?.slice(0, 1) ?? '用')
function handleLogout() {
  auth.logout()
  void router.push('/login')
}
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  background: var(--crm-color-bg-page);
}
.app-layout__aside {
  position: sticky;
  top: 0;
  height: 100vh;
  background: var(--crm-color-bg-card);
  border-right: 1px solid var(--crm-color-border);
  overflow-y: auto;
}
.app-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--crm-color-bg-card);
  border-bottom: 1px solid var(--crm-color-border);
  padding: 0 var(--crm-spacing-xl);
  min-height: var(--crm-header-height);
}
.app-layout__context {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--crm-color-text-tertiary);
  font-size: var(--crm-font-size-xs);
}
.app-layout__context i {
  color: var(--crm-color-border-strong);
  font-style: normal;
}
.app-layout__context strong {
  color: var(--crm-color-text-primary);
  font-weight: 650;
}
.app-layout__user {
  display: flex;
  align-items: center;
  gap: 9px;
}
.app-layout__avatar {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: var(--crm-color-primary-light);
  color: var(--crm-color-primary-active);
  font-size: var(--crm-font-size-xs);
  font-weight: 750;
}
.app-layout__identity strong,
.app-layout__identity small {
  display: block;
}
.app-layout__identity strong {
  color: var(--crm-color-text-primary);
  font-size: var(--crm-font-size-xs);
  line-height: 16px;
}
.app-layout__identity small {
  color: var(--crm-color-text-tertiary);
  font-size: 10px;
  line-height: 13px;
}
.app-layout__logout {
  margin-left: var(--crm-spacing-xs);
  color: var(--crm-color-text-tertiary);
}
.app-layout__main {
  background: var(--crm-color-bg-page);
  padding: 0;
  overflow: visible;
}
</style>
