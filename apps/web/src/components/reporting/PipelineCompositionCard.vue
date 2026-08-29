<template>
  <section class="pipeline-composition" :class="{ 'pipeline-composition--compact': compact }">
    <header class="pipeline-composition__header">
      <div>
        <span class="pipeline-composition__eyebrow">{{ title }}</span>
        <small>截至 {{ pool.asOf }} · 每个开放商机只计一次</small>
      </div>
      <div class="pipeline-composition__total">
        <strong>{{ money(pool.totalAmount) }}</strong>
        <span>{{ pool.totalCount }} 个开放商机</span>
      </div>
    </header>

    <div
      v-if="pool.totalAmount > 0"
      class="pipeline-composition__bar"
      :aria-label="compositionLabel"
      role="img"
    >
      <span
        v-for="bucket in pool.buckets"
        :key="bucket.key"
        :class="`is-${bucket.key}`"
        :style="{ width: `${percentage(bucket.amount)}%` }"
        :title="`${bucket.label}：${money(bucket.amount)}，${percentage(bucket.amount)}%`"
      />
    </div>
    <div v-else class="pipeline-composition__bar pipeline-composition__bar--empty">
      当前没有开放商机金额
    </div>

    <div class="pipeline-composition__legend">
      <div v-for="bucket in pool.buckets" :key="bucket.key" class="pipeline-composition__item">
        <i :class="`is-${bucket.key}`" />
        <span>
          <b>{{ bucket.label }}</b>
          <small>{{ bucket.count }} 个 · {{ percentage(bucket.amount) }}%</small>
        </span>
        <strong>{{ money(bucket.amount) }}</strong>
      </div>
    </div>

    <footer v-if="showHealth" class="pipeline-composition__health">
      <span>
        其中停滞
        <b :class="{ 'is-danger': pool.health.stagnantCount > 0 }">
          {{ money(pool.health.stagnantAmount) }} · {{ pool.health.stagnantCount }} 个
        </b>
      </span>
      <span>行动逾期 {{ pool.health.overdueActionCount }} 个</span>
      <span>无下一步 {{ pool.health.noNextActionCount }} 个</span>
    </footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PipelinePool } from '@crm/domain'

const props = withDefaults(
  defineProps<{
    pool: PipelinePool
    title?: string
    compact?: boolean
    showHealth?: boolean
  }>(),
  { title: '当前开放商机池', compact: false, showHealth: true },
)

const compositionLabel = computed(() =>
  props.pool.buckets.map((bucket) => `${bucket.label}${percentage(bucket.amount)}%`).join('，'),
)

function percentage(amount: number): number {
  if (!props.pool.totalAmount) return 0
  return Math.round((amount / props.pool.totalAmount) * 100)
}
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
</script>

<style scoped>
.pipeline-composition {
  display: grid;
  gap: var(--crm-spacing-md);
  padding: var(--crm-spacing-lg);
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.pipeline-composition__header,
.pipeline-composition__health,
.pipeline-composition__item {
  display: flex;
  align-items: center;
}
.pipeline-composition__header {
  justify-content: space-between;
  gap: var(--crm-spacing-lg);
}
.pipeline-composition__header small,
.pipeline-composition__item small {
  display: block;
  margin-top: 3px;
  color: var(--crm-color-text-secondary);
}
.pipeline-composition__eyebrow {
  font-weight: 600;
}
.pipeline-composition__total {
  text-align: right;
}
.pipeline-composition__total strong,
.pipeline-composition__total span {
  display: block;
}
.pipeline-composition__total strong {
  font-size: 28px;
  line-height: 1.15;
}
.pipeline-composition__total span {
  margin-top: 4px;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
.pipeline-composition__bar {
  display: flex;
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--crm-color-bg-page);
}
.pipeline-composition__bar span {
  min-width: 0;
  transition: width 0.2s ease;
}
.pipeline-composition__bar span + span {
  border-left: 2px solid var(--crm-color-bg-card);
}
.pipeline-composition__bar--empty {
  align-items: center;
  justify-content: center;
  height: 28px;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
.pipeline-composition__legend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--crm-spacing-md);
}
.pipeline-composition__item {
  min-width: 0;
  gap: 8px;
}
.pipeline-composition__item i {
  width: 8px;
  height: 30px;
  flex: 0 0 auto;
  border-radius: 4px;
}
.pipeline-composition__item span {
  min-width: 0;
  flex: 1;
}
.pipeline-composition__item b,
.pipeline-composition__item strong {
  font-size: 13px;
}
.pipeline-composition__health {
  flex-wrap: wrap;
  gap: 8px 20px;
  padding-top: var(--crm-spacing-sm);
  border-top: 1px solid var(--crm-color-border);
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
.pipeline-composition__health b {
  margin-left: 4px;
  color: var(--crm-color-text-primary);
}
.pipeline-composition__health b.is-danger {
  color: var(--crm-color-danger);
}
.is-estimate {
  background: #94a3b8;
}
.is-oral_quote {
  background: var(--crm-color-primary);
}
.is-formal_quote {
  background: var(--el-color-success);
}
.pipeline-composition--compact {
  gap: var(--crm-spacing-sm);
  padding: var(--crm-spacing-md);
}
.pipeline-composition--compact .pipeline-composition__total strong {
  font-size: 22px;
}
.pipeline-composition--compact .pipeline-composition__bar {
  height: 10px;
}
.pipeline-composition--compact .pipeline-composition__item i {
  height: 22px;
}
@media (max-width: 900px) {
  .pipeline-composition__legend {
    grid-template-columns: 1fr;
  }
}
</style>
