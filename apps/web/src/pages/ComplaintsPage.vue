<template>
  <div class="complaints">
    <AppPageHeader title="客诉管理" description="按处理状态和下一行动持续推进，直到明确解决" />

    <el-card class="complaints__card">
      <el-table
        v-if="!error && items?.length"
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
        <el-table-column label="下一行动" min-width="180">
          <template #default="{ row }">{{
            (row as Complaint).currentAction?.content ?? '-'
          }}</template>
        </el-table-column>
        <el-table-column label="计划时间" width="160">
          <template #default="{ row }">{{
            timeText((row as Complaint).currentAction?.plannedAt)
          }}</template>
        </el-table-column>
      </el-table>
      <AppQueryState
        :error="error"
        :empty="!loading && !items?.length"
        empty-text="暂无客诉记录"
        @retry="reload"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useQuery, listComplaints, COMPLAINT_TYPE_OPTIONS, type Complaint } from '@crm/domain'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'

const router = useRouter()
const { data: items, loading, error, reload } = useQuery('complaints:list', () => listComplaints())

function typeLabel(type: string): string {
  return COMPLAINT_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type
}
function timeText(value: string | undefined): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}
</script>

<style scoped>
.complaints {
  padding: var(--crm-spacing-xl);
}
.complaints__card {
  max-width: 860px;
}
</style>
