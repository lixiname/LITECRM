<template>
  <div class="opps">
    <header class="opps__header">
      <h1 class="opps__title">商机管理</h1>
      <el-button @click="router.push('/')">返回首页</el-button>
    </header>

    <el-card class="opps__card">
      <el-table
        v-loading="loading"
        :data="opps ?? []"
        border
        @row-click="(row: Opportunity) => router.push(`/opportunities/${row.id}`)"
      >
        <el-table-column prop="name" label="商机" min-width="160" />
        <el-table-column label="阶段" width="90">
          <template #default="{ row }">
            <el-tag :type="stageTag((row as Opportunity).stage)">
              {{ stageLabel((row as Opportunity).stage) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="意向金额" width="110">
          <template #default="{ row }">{{ amountText((row as Opportunity).amount) }}</template>
        </el-table-column>
        <el-table-column label="下次跟进" width="110">
          <template #default="{ row }">{{ (row as Opportunity).nextFollowUpDate ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="nextAction" label="下一步" min-width="140" />
      </el-table>
      <p v-if="opps && opps.length === 0" class="opps__empty">暂无商机</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  useQuery,
  listOpportunities,
  OPPORTUNITY_STAGE_OPTIONS,
  type Opportunity,
  type OpportunityStage,
} from '@crm/domain'

const router = useRouter()
const { data: opps, loading } = useQuery('opportunities:list', () => listOpportunities())

function stageTag(stage: OpportunityStage): 'success' | 'warning' | 'info' | 'danger' {
  return stage === 'ordered'
    ? 'success'
    : stage === 'lost' || stage === 'demand_disappeared'
      ? 'danger'
      : stage === 'following'
        ? 'warning'
        : 'info'
}
function stageLabel(stage: OpportunityStage): string {
  return OPPORTUNITY_STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? stage
}
function amountText(amount: string | null): string {
  return amount ? `¥${Number(amount).toLocaleString()}` : '-'
}
</script>

<style scoped>
.opps {
  padding: var(--crm-spacing-xl);
}
.opps__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-lg);
}
.opps__title {
  margin: 0;
  color: var(--crm-color-text-primary);
}
.opps__card {
  max-width: 960px;
}
.opps__empty {
  text-align: center;
  color: var(--crm-color-text-secondary);
  padding: var(--crm-spacing-xl);
}
</style>
