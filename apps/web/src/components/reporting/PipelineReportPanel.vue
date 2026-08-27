<template>
  <div class="pipeline-panel">
    <section class="pipeline-panel__metrics">
      <ReportingMetricCard
        v-for="bucket in data.pool.buckets"
        :key="bucket.key"
        :label="bucket.label"
        :value="money(bucket.amount)"
        :hint="`${bucket.count} 个开放商机`"
        :tone="bucket.key === 'formal_quote' ? 'success' : bucket.key === 'oral_quote' ? 'primary' : undefined"
      />
      <ReportingMetricCard
        label="开放商机池合计"
        :value="money(data.pool.totalAmount)"
        :hint="`${data.pool.totalCount} 个商机，每个商机只计一次`"
        tone="primary"
      />
    </section>

    <el-card shadow="never">
      <template #header>
        <div class="pipeline-panel__title">
          <span>期间转化</span>
          <small>{{ data.range.start }} 至 {{ data.range.end }}</small>
        </div>
      </template>
      <div class="pipeline-panel__flow">
        <div v-for="step in flowSteps" :key="step.label" class="pipeline-panel__step">
          <span>{{ step.label }}</span>
          <strong>{{ step.metric.count }}</strong>
          <small>{{ money(step.metric.amount) }}</small>
        </div>
      </div>
      <div class="pipeline-panel__rate">
        结案赢单率：
        <strong>{{ data.flow.closedWinRate === null ? '暂无可计算结案' : percent(data.flow.closedWinRate) }}</strong>
        <small>赢单 ÷（赢单 + 丢失/需求消失）</small>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>下辖人员商机与报价池</template>
      <el-table
        :data="data.byOwner"
        border
        row-class-name="pipeline-panel__row"
        @row-click="openOwnerOpportunities"
      >
        <el-table-column prop="ownerName" label="负责人" min-width="110" fixed />
        <el-table-column prop="openCount" label="开放商机" width="95" align="right" />
        <el-table-column label="商机池" min-width="130" align="right">
          <template #default="{ row }">{{ money((row as PipelineOwnerRow).openAmount) }}</template>
        </el-table-column>
        <el-table-column label="口头报价" min-width="130" align="right">
          <template #default="{ row }">{{ money((row as PipelineOwnerRow).oralQuoteAmount) }}</template>
        </el-table-column>
        <el-table-column label="正式报价" min-width="130" align="right">
          <template #default="{ row }">{{ money((row as PipelineOwnerRow).formalQuoteAmount) }}</template>
        </el-table-column>
        <el-table-column label="停滞金额" min-width="130" align="right">
          <template #default="{ row }">
            <span :class="{ 'pipeline-panel__danger': (row as PipelineOwnerRow).stagnantAmount > 0 }">
              {{ money((row as PipelineOwnerRow).stagnantAmount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="本期成交" min-width="130" align="right">
          <template #default="{ row }">{{ money((row as PipelineOwnerRow).wonAmount) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { PipelineOwnerRow, PipelineReport } from '@crm/domain'
import ReportingMetricCard from './ReportingMetricCard.vue'

const props = defineProps<{ data: PipelineReport }>()
const router = useRouter()
const flowSteps = computed(() => [
  { label: '新增商机', metric: props.data.flow.created },
  { label: '首次报价', metric: props.data.flow.firstQuoted },
  { label: '首次正式报价', metric: props.data.flow.firstFormalQuoted },
  { label: '确认成交', metric: props.data.flow.won },
  { label: '失败结案', metric: props.data.flow.lost },
])
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
function openOwnerOpportunities(row: PipelineOwnerRow) {
  void router.push({ path: '/opportunities', query: { ownerId: row.ownerId } })
}
</script>

<style scoped>
.pipeline-panel {
  display: grid;
  gap: var(--crm-spacing-md);
}
.pipeline-panel__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--crm-spacing-md);
}
.pipeline-panel__title,
.pipeline-panel__rate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
}
.pipeline-panel__title small,
.pipeline-panel__rate small {
  color: var(--crm-color-text-secondary);
}
.pipeline-panel__flow {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--crm-spacing-sm);
  margin-bottom: var(--crm-spacing-lg);
}
.pipeline-panel__step {
  display: grid;
  gap: 4px;
  padding: var(--crm-spacing-md);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-bg-page);
  text-align: center;
}
.pipeline-panel__step strong {
  font-size: 24px;
}
.pipeline-panel__step small {
  color: var(--crm-color-text-secondary);
}
.pipeline-panel__danger {
  color: var(--el-color-danger);
  font-weight: 600;
}
:deep(.pipeline-panel__row) {
  cursor: pointer;
}
</style>
