<template>
  <div class="complaints">
    <header class="complaints__header">
      <h1 class="complaints__title">客诉管理</h1>
      <el-button @click="router.push('/')">返回首页</el-button>
    </header>

    <el-card class="complaints__card">
      <el-table
        v-loading="loading"
        :data="items ?? []"
        border
        @row-click="(row: Complaint) => router.push(`/complaints/${row.id}`)"
      >
        <el-table-column prop="description" label="描述" min-width="180" />
        <el-table-column label="类型" width="90">
          <template #default="{ row }">{{ typeLabel((row as Complaint).type) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="(row as Complaint).status === 'resolved' ? 'success' : 'danger'">
              {{ (row as Complaint).status === 'resolved' ? '已解决' : '处理中' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下次确认" width="110">
          <template #default="{ row }">{{ (row as Complaint).nextFollowUpDate ?? '-' }}</template>
        </el-table-column>
      </el-table>
      <p v-if="items && items.length === 0" class="complaints__empty">暂无客诉</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useQuery, listComplaints, COMPLAINT_TYPE_OPTIONS, type Complaint } from '@crm/domain'

const router = useRouter()
const { data: items, loading } = useQuery('complaints:list', () => listComplaints())

function typeLabel(type: string): string {
  return COMPLAINT_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type
}
</script>

<style scoped>
.complaints {
  padding: var(--crm-spacing-xl);
}
.complaints__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-lg);
}
.complaints__title {
  margin: 0;
  color: var(--crm-color-text-primary);
}
.complaints__card {
  max-width: 860px;
}
.complaints__empty {
  text-align: center;
  color: var(--crm-color-text-secondary);
  padding: var(--crm-spacing-xl);
}
</style>
