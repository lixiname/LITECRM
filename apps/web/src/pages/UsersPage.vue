<template>
  <div class="users">
    <AppPageHeader title="用户管理" description="维护账号、角色和组织内使用状态" />

    <el-card class="users__card">
      <el-table v-if="!error && users?.length" v-loading="loading" :data="users" border>
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
      <AppQueryState
        :error="error"
        :empty="!loading && !users?.length"
        empty-text="暂无用户"
        @retry="reload"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { listUsers, ROLE_LABELS, useQuery, type Role } from '@crm/domain'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'

const { data: users, loading, error, reload } = useQuery('users:list', listUsers)
</script>

<style scoped>
.users {
  padding: var(--crm-spacing-xl);
}
.users__card {
  max-width: 720px;
}
</style>
