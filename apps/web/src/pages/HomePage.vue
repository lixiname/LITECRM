<template>
  <div class="home">
    <header class="home__header">
      <h1 class="home__title">Lite CRM · 桌面端</h1>
      <el-button v-if="auth.isLoggedIn" @click="handleLogout">退出登录</el-button>
    </header>

    <el-card v-if="auth.isLoggedIn" class="home__card">
      <template #header>当前用户</template>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="姓名">{{ auth.user?.displayName }}</el-descriptions-item>
        <el-descriptions-item label="账号">{{ auth.user?.username }}</el-descriptions-item>
        <el-descriptions-item label="角色">
          {{ ROLE_LABELS[auth.user?.role ?? 'sales'] }}
        </el-descriptions-item>
        <el-descriptions-item label="数据范围">
          {{ DATA_SCOPE_LABELS[auth.dataScope ?? 'self'] }}
        </el-descriptions-item>
        <el-descriptions-item label="能力点">
          {{ auth.capabilities.join(' / ') }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <p v-else class="home__hint">登录后查看会话信息</p>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore, ROLE_LABELS, DATA_SCOPE_LABELS } from '@crm/domain'

const router = useRouter()
const auth = useAuthStore()

function handleLogout() {
  auth.logout()
  void router.push('/login')
}
</script>

<style scoped>
.home {
  padding: var(--crm-spacing-xl);
}
.home__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-lg);
}
.home__title {
  margin: 0;
  color: var(--crm-color-text-primary);
}
.home__card {
  max-width: 640px;
}
.home__hint {
  color: var(--crm-color-text-secondary);
}
</style>
