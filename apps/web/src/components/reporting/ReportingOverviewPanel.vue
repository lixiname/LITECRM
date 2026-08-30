<template>
  <div class="overview-panel">
    <section class="overview-panel__headline">
      <PipelineCompositionCard :pool="data.pipeline.pool" compact />
      <div class="overview-panel__period-results">
        <div class="overview-panel__period-label">
          期间结果 · {{ data.range.start }} 至 {{ data.range.end }}
        </div>
        <ReportingMetricCard
          label="本期成交"
          :value="money(data.pipeline.wonAmount)"
          hint="CRM 确认成交金额"
          tone="success"
        />
        <ReportingMetricCard
          label="结案赢单率"
          :value="
            data.pipeline.closedWinRate === null ? '暂无样本' : percent(data.pipeline.closedWinRate)
          "
          hint="赢单 ÷（赢单 + 失败结案）"
          tone="primary"
        />
      </div>
    </section>

    <section class="overview-panel__columns">
      <el-card shadow="never">
        <template #header>
          <div class="overview-panel__title">
            <span>S/A 客户需要关注</span>
            <el-tag type="danger" effect="plain">{{ data.keyCustomers.attentionCount }}</el-tag>
          </div>
        </template>
        <div v-if="data.keyCustomers.topAttention.length" class="overview-panel__risks">
          <button
            v-for="customer in data.keyCustomers.topAttention"
            :key="customer.id"
            type="button"
            @click="router.push(`/customers/${customer.id}`)"
          >
            <span
              ><b>{{ customer.grade }}</b> · {{ customer.name }}</span
            >
            <small>{{ customer.ownerName }} · {{ riskText(customer.reasons[0]) }}</small>
          </button>
        </div>
        <el-empty v-else description="当前没有需要关注的 S/A 客户" :image-size="72" />
      </el-card>

      <div class="overview-panel__side">
        <ReportingMetricCard
          label="本期实际业务记录"
          :value="data.team.actualRecordCount"
          :hint="`待执行 ${data.team.pendingCount} · 逾期 ${data.team.overdueCount}`"
          :tone="data.team.overdueCount ? 'danger' : 'primary'"
        />
        <ReportingMetricCard
          label="本期已提交费用"
          :value="money(data.expenses.submittedAmount)"
          :hint="`尚有 ${data.expenses.draftDays} 条费用草稿`"
          :tone="data.expenses.draftDays ? 'warning' : undefined"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { ReportingOverview } from '@crm/domain'
import PipelineCompositionCard from './PipelineCompositionCard.vue'
import ReportingMetricCard from './ReportingMetricCard.vue'

defineProps<{ data: ReportingOverview }>()
const router = useRouter()

const labels: Record<string, string> = {
  unresolved_complaint: '存在未解决客诉',
  overdue_action: '存在逾期行动',
  no_pending_action: '开放商机缺少下一步',
  action_overdue: '商机行动已逾期',
  inactive_30d: '商机超过 30 天无动作',
  expected_close_overdue: '预计成交日已过',
  customer_inactive_30d: '客户超过 30 天无活动',
}
function riskText(value?: string): string {
  return value ? (labels[value] ?? value) : '需要关注'
}
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
</script>

<style scoped>
.overview-panel,
.overview-panel__side,
.overview-panel__risks {
  display: grid;
  gap: var(--crm-spacing-lg);
}
.overview-panel__headline {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: var(--crm-spacing-lg);
}
.overview-panel__period-results {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--crm-spacing-lg);
}
.overview-panel__period-label {
  grid-column: 1 / -1;
  align-self: end;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
.overview-panel__columns {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr);
  gap: var(--crm-spacing-lg);
}
.overview-panel__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.overview-panel__risks button {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
  padding: var(--crm-spacing-md);
  border: 0;
  border: 1px solid transparent;
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-soft);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.overview-panel__risks button:hover {
  border-color: var(--crm-color-border-strong);
  background: var(--crm-color-primary-lighter);
}
.overview-panel__risks b {
  color: var(--el-color-danger);
}
.overview-panel__risks small {
  color: var(--crm-color-text-secondary);
}
@media (max-width: 1100px) {
  .overview-panel__headline {
    grid-template-columns: 1fr;
  }
}
</style>
