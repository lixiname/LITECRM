<template>
  <section class="my-pipeline-card">
    <div class="my-pipeline-card__header">
      <span>
        <b>我的开放商机</b>
        <small v-if="summary">截至 {{ summary.pool.asOf }}</small>
      </span>
      <span v-if="summary" class="my-pipeline-card__total">
        <strong>{{ money(summary.pool.totalAmount) }}</strong>
        <small>{{ summary.pool.totalCount }} 个</small>
      </span>
    </div>

    <van-loading v-if="loading" size="20px">加载商机摘要</van-loading>
    <div v-else-if="error" class="my-pipeline-card__error">
      <span>{{ error }}</span
      ><van-button size="mini" plain @click="reload">重试</van-button>
    </div>
    <template v-else-if="summary">
      <div v-if="summary.pool.totalAmount" class="my-pipeline-card__bar">
        <span
          v-for="bucket in summary.pool.buckets"
          :key="bucket.key"
          :class="`is-${bucket.key}`"
          :style="{ width: `${percentage(bucket.amount)}%` }"
        />
      </div>
      <div v-else class="my-pipeline-card__empty">当前没有开放商机金额</div>
      <div class="my-pipeline-card__legend">
        <span v-for="bucket in summary.pool.buckets" :key="bucket.key">
          <i :class="`is-${bucket.key}`" />
          <b>{{ bucket.label }}</b>
          <small>{{ bucket.count }} 个</small>
          <strong>{{ money(bucket.amount) }}</strong>
          <em>{{ percentage(bucket.amount) }}%</em>
        </span>
      </div>
      <div class="my-pipeline-card__health">
        <span :class="{ 'is-danger': summary.pool.health.stagnantCount }">
          停滞 {{ summary.pool.health.stagnantCount }} 个
        </span>
        <span>行动逾期 {{ summary.pool.health.overdueActionCount }} 个</span>
        <span>无下一步 {{ summary.pool.health.noNextActionCount }} 个</span>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { getMyPipelineSummary, useQuery } from '@crm/domain'

const {
  data: summary,
  loading,
  error,
  reload,
} = useQuery('mobile:reporting:my-pipeline', getMyPipelineSummary)

function percentage(amount: number): number {
  const total = summary.value?.pool.totalAmount ?? 0
  return total ? Math.round((amount / total) * 100) : 0
}
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
</script>

<style scoped>
.my-pipeline-card {
  display: grid;
  gap: var(--crm-spacing-md);
  margin: var(--crm-spacing-md);
  padding: var(--crm-spacing-md);
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.my-pipeline-card__header,
.my-pipeline-card__error,
.my-pipeline-card__health {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-sm);
}
.my-pipeline-card__header small,
.my-pipeline-card__total strong,
.my-pipeline-card__total small {
  display: block;
}
.my-pipeline-card__header small,
.my-pipeline-card__legend small {
  margin-top: 3px;
  color: var(--crm-color-text-secondary);
  font-size: 11px;
}
.my-pipeline-card__total {
  text-align: right;
}
.my-pipeline-card__total strong {
  font-size: 21px;
}
.my-pipeline-card__bar {
  display: flex;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--crm-color-bg-page);
}
.my-pipeline-card__bar span + span {
  border-left: 1px solid #fff;
}
.my-pipeline-card__empty {
  padding: var(--crm-spacing-sm);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-bg-page);
  color: var(--crm-color-text-secondary);
  text-align: center;
  font-size: 12px;
}
.my-pipeline-card__legend {
  display: grid;
  gap: 2px;
}
.my-pipeline-card__legend span {
  display: grid;
  grid-template-columns: 8px minmax(76px, 1fr) 36px minmax(76px, auto) 34px;
  align-items: center;
  gap: 7px;
  min-width: 0;
  padding: 6px 0;
}
.my-pipeline-card__legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.my-pipeline-card__legend b {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.my-pipeline-card__legend small {
  margin: 0;
  text-align: right;
}
.my-pipeline-card__legend strong,
.my-pipeline-card__legend em {
  font-size: 11px;
  text-align: right;
  white-space: nowrap;
}
.my-pipeline-card__legend em {
  color: var(--crm-color-text-secondary);
  font-style: normal;
  font-variant-numeric: tabular-nums;
}
.my-pipeline-card__health {
  justify-content: flex-start;
  flex-wrap: wrap;
  padding-top: var(--crm-spacing-sm);
  border-top: 1px solid var(--crm-color-border);
  color: var(--crm-color-text-secondary);
  font-size: 11px;
}
.my-pipeline-card__health .is-danger {
  color: var(--crm-color-danger);
}
.is-estimate {
  background: #94a3b8;
}
.is-oral_quote {
  background: var(--crm-color-primary);
}
.is-formal_quote {
  background: var(--crm-color-success);
}
</style>
