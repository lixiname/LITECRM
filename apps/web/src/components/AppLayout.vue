<template>
  <el-container class="app-layout">
    <el-aside width="200px" class="app-layout__aside">
      <div class="app-layout__logo">Lite CRM</div>
      <el-menu :default-active="activeMenu" router class="app-layout__menu">
        <el-menu-item v-if="auth.hasAbility('dashboard.view')" index="/management">
          管理看板
        </el-menu-item>
        <el-menu-item index="/customers">客户</el-menu-item>
        <el-menu-item index="/opportunities">商机</el-menu-item>
        <el-menu-item index="/complaints">客诉</el-menu-item>
        <el-menu-item index="/expenses">费用</el-menu-item>
        <el-menu-item index="/week-view">销售计划</el-menu-item>
        <el-menu-item v-if="auth.hasAbility('approve.claim')" index="/claims"
          >接管审批</el-menu-item
        >
        <el-menu-item v-if="auth.hasAbility('user.manage')" index="/catalog">字典配置</el-menu-item>
        <el-menu-item v-if="auth.hasAbility('user.manage')" index="/users">用户管理</el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="app-layout__header">
        <span class="app-layout__title">{{ route.meta.title ?? '' }}</span>
        <div class="app-layout__user">
          <span class="app-layout__username">{{ auth.user?.displayName }}</span>
          <el-button link type="danger" @click="handleLogout">退出</el-button>
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

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

// 侧边栏激活项：取一级路径（/customers/:id → /customers）
const activeMenu = computed(() => `/${route.path.split('/')[1] ?? ''}`)

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
  background: var(--crm-color-bg-card);
  border-right: 1px solid var(--crm-color-border);
  box-shadow: 2px 0 8px rgb(0 0 0 / 3%);
}
.app-layout__logo {
  padding: var(--crm-spacing-lg);
  font-size: var(--crm-font-size-lg);
  font-weight: 600;
  color: var(--crm-color-primary);
}
.app-layout__menu {
  border-right: none;
  --el-menu-bg-color: transparent;
}
.app-layout__menu :deep(.el-menu-item) {
  margin: 0 8px;
  border-radius: var(--crm-radius-sm);
  width: auto;
}
.app-layout__menu :deep(.el-menu-item.is-active) {
  background: var(--crm-color-primary-light);
  color: var(--crm-color-primary);
}
.app-layout__menu :deep(.el-menu-item:hover) {
  background: #f5f7fa;
}
.app-layout__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--crm-color-bg-card);
  border-bottom: 1px solid var(--crm-color-border);
  padding: 0 var(--crm-spacing-lg);
  min-height: 64px;
}
.app-layout__title {
  font-size: var(--crm-font-size-md);
  font-weight: 600;
  color: var(--crm-color-text-primary);
}
.app-layout__user {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-sm);
}
.app-layout__username {
  color: var(--crm-color-text-secondary);
}
.app-layout__main {
  background: var(--crm-color-bg-page);
  padding: 0;
}
</style>
