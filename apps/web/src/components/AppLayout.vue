<template>
  <el-container class="app-layout">
    <el-aside width="248px" class="app-layout__aside">
      <AppSidebarNav :active-menu="activeMenu" />
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
import AppSidebarNav from './AppSidebarNav.vue'

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
  position: sticky;
  top: 0;
  height: 100vh;
  background: var(--crm-color-bg-card);
  border-right: 1px solid var(--crm-color-border);
  box-shadow: 2px 0 8px rgb(0 0 0 / 3%);
  overflow-y: auto;
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
