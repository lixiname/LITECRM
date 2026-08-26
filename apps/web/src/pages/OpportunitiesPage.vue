<template>
  <div class="opps">
    <AppPageHeader title="商机管理" description="跟进、报价和成交分别留痕，下一行动保持可见" />

    <el-card class="opps__card">
      <el-table
        v-if="!error && opps?.length"
        v-loading="loading"
        :data="opps ?? []"
        border
        @row-click="(row: Opportunity) => router.push(`/opportunities/${row.id}`)"
      >
        <el-table-column prop="name" label="商机" min-width="160" />
        <el-table-column prop="customerName" label="所属客户" min-width="160">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              @click.stop="void router.push(`/customers/${(row as Opportunity).customerId}`)"
            >
              {{ (row as Opportunity).customerName ?? '-' }}
            </el-button>
          </template>
        </el-table-column>
        <el-table-column label="阶段" width="90">
          <template #default="{ row }">
            <el-tag :type="stageTag((row as Opportunity).stage)">
              {{ stageLabel((row as Opportunity).stage) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="意向规模" width="110">
          <template #default="{ row }">{{
            amountText((row as Opportunity).estimatedAmount)
          }}</template>
        </el-table-column>
        <el-table-column label="下一行动" min-width="180">
          <template #default="{ row }">{{
            (row as Opportunity).currentAction?.content ?? '-'
          }}</template>
        </el-table-column>
        <el-table-column label="计划时间" width="160">
          <template #default="{ row }">{{
            timeText((row as Opportunity).currentAction?.plannedAt)
          }}</template>
        </el-table-column>
      </el-table>
      <AppQueryState
        :error="error"
        :empty="!loading && !opps?.length"
        empty-text="暂无商机；请从客户详情建立商机"
        @retry="reload"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import {
  useQuery,
  listOpportunities,
  OPPORTUNITY_STAGE_OPTIONS,
  type Opportunity,
  type OpportunityStage,
} from '@crm/domain'

const router = useRouter()
const {
  data: opps,
  loading,
  error,
  reload,
} = useQuery('opportunities:list', () => listOpportunities())

function stageTag(stage: OpportunityStage): 'success' | 'warning' | 'info' | 'danger' {
  return stage === 'won'
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
function timeText(value: string | undefined): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}
</script>

<style scoped>
.opps {
  padding: var(--crm-spacing-xl);
}
.opps__card {
  width: 100%;
  max-width: none;
}
</style>
