<template>
  <section class="pipeline-composition" :class="{ 'pipeline-composition--compact': compact }">
    <header class="pipeline-composition__header">
      <div>
        <span class="pipeline-composition__eyebrow">{{ title }}</span>
        <small>{{ subtitle ?? `截至 ${pool.asOf} · 每个开放商机只计一次` }}</small>
      </div>
      <div v-if="$slots['header-action']" class="pipeline-composition__header-action">
        <slot name="header-action" />
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
        <b>{{ bucket.label }}</b>
        <small>{{ bucket.count }} 个</small>
        <span class="pipeline-composition__item-value">
          <strong>{{ money(bucket.amount) }}</strong>
          <em>{{ percentage(bucket.amount) }}%</em>
        </span>
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
    subtitle?: string
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
  border-radius: var(--crm-radius-lg);
  background: var(--crm-color-bg-card);
  box-shadow: var(--crm-shadow-card);
}
.pipeline-composition__header,
.pipeline-composition__health,
.pipeline-composition__item {
  display: flex;
  align-items: center;
}
.pipeline-composition__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  gap: var(--crm-spacing-lg);
}
.pipeline-composition__header-action {
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.pipeline-composition__header small,
.pipeline-composition__item small {
  display: block;
  margin-top: 3px;
  color: var(--crm-color-text-secondary);
}
.pipeline-composition__eyebrow {
  font-weight: 680;
}
.pipeline-composition__total {
  text-align: right;
}
.pipeline-composition__total strong,
.pipeline-composition__total span {
  display: block;
}
.pipeline-composition__total strong {
  font-size: 27px;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.03em;
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
  border-radius: 3px;
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
  gap: 8px;
}
.pipeline-composition__item {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) auto;
  grid-template-rows: auto auto;
  gap: 2px 8px;
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--crm-color-divider);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-bg-subtle);
}
.pipeline-composition__item i {
  grid-row: 1 / 3;
  align-self: center;
  width: 8px;
  height: 8px;
  flex: 0 0 auto;
  border-radius: 50%;
}
.pipeline-composition__item small {
  grid-column: 2;
  margin: 0;
  font-size: 11px;
}
.pipeline-composition__item b,
.pipeline-composition__item strong {
  font-size: 13px;
}
.pipeline-composition__item-value {
  grid-column: 3;
  grid-row: 1 / 3;
  align-self: center;
  display: grid;
  gap: 1px;
  text-align: right;
  white-space: nowrap;
}
.pipeline-composition__item-value em {
  color: var(--crm-color-text-secondary);
  font-size: 11px;
  font-style: normal;
  font-variant-numeric: tabular-nums;
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
  background: #b5bdb9;
}
.is-oral_quote {
  background: #8daaa0;
}
.is-formal_quote {
  background: var(--crm-color-primary);
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
@media (max-width: 900px) {
  .pipeline-composition__header {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .pipeline-composition__header-action {
    grid-column: 1;
    grid-row: 2;
  }
  .pipeline-composition__total {
    grid-column: 2;
    grid-row: 1 / 3;
  }
}
@media (max-width: 720px) {
  .pipeline-composition__legend {
    grid-template-columns: 1fr;
  }
}
</style>
