<template>
  <div class="users">
    <header class="users__header">
      <h1 class="users__title">用户管理</h1>
      <el-button @click="router.push('/')">返回首页</el-button>
    </header>

    <el-card class="users__card">
      <el-table v-loading="loading" :data="users ?? []" border>
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="displayName" label="显示名" min-width="120" />
        <el-table-column label="角色" min-width="100">
          <template #default="{ row }">
            {{ ROLE_LABELS[row.role as Role] }}
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="90">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <p v-if="error" class="users__error">{{ error }}</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { listUsers, ROLE_LABELS, useQuery, type Role } from '@crm/domain'

const router = useRouter()
const { data: users, loading, error } = useQuery('users:list', listUsers)
</script>

<style scoped>
.users {
  padding: var(--crm-spacing-xl);
}
.users__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-lg);
}
.users__title {
  margin: 0;
  color: var(--crm-color-text-primary);
}
.users__card {
  max-width: 720px;
}
.users__error {
  color: var(--crm-color-danger);
}
</style>
