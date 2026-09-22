<template>
  <section class="cockpit-panel cockpit-pipeline">
    <header class="cockpit-panel__head">
      <div>
        <h2>当前有效商机池</h2>
        <p>每个开放商机只计一次，采用当前有效金额</p>
      </div>
      <span class="cockpit-panel__value">截至 {{ shortDate(pool.asOf) }}</span>
    </header>
    <div class="cockpit-panel__body">
      <div class="cockpit-pipeline__total">
        <div>
          <span>有效商机总额</span>
          <strong>{{ money(pool.totalAmount) }}</strong>
        </div>
        <small>{{ pool.totalCount }} 个开放商机</small>
      </div>

      <div class="cockpit-pipeline__bar" role="img" :aria-label="compositionLabel">
        <span
          v-for="bucket in pool.buckets"
          :key="bucket.key"
          :class="`is-${bucket.key}`"
          :style="{ width: `${percent(bucket.amount)}%` }"
        />
      </div>

      <div class="cockpit-pipeline__legend">
        <article v-for="bucket in pool.buckets" :key="bucket.key">
          <header><i :class="`is-${bucket.key}`" />{{ bucket.label }}</header>
          <strong>{{ compactMoney(bucket.amount) }}</strong>
          <small>{{ bucket.count }} 个 · {{ percent(bucket.amount) }}%</small>
        </article>
      </div>

      <div class="cockpit-pipeline__risks">
        <div>
          <strong>{{ pool.health.stagnantCount }}</strong>
          <span>停滞商机</span>
        </div>
        <div>
          <strong>{{ pool.health.overdueActionCount }}</strong>
          <span>行动逾期</span>
        </div>
        <div>
          <strong>{{ pool.health.noNextActionCount }}</strong>
          <span>没有下一步</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PipelinePool } from '@crm/domain'

const props = defineProps<{ pool: PipelinePool }>()
const compositionLabel = computed(() =>
  props.pool.buckets.map((item) => `${item.label}${percent(item.amount)}%`).join('，'),
)
function percent(value: number): number {
  return props.pool.totalAmount ? Math.round((value / props.pool.totalAmount) * 100) : 0
}
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
function compactMoney(value: number): string {
  if (value >= 100_000_000) return `¥${(value / 100_000_000).toFixed(2)}亿`
  if (value >= 10_000) return `¥${(value / 10_000).toFixed(value >= 1_000_000 ? 0 : 1)}万`
  return money(value)
}
function shortDate(value: string): string {
  return value.replaceAll('-', '.')
}
</script>

<style scoped>
.cockpit-pipeline {
  border-top: 3px solid #326d5b;
}
.cockpit-pipeline__total {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.cockpit-pipeline__total span,
.cockpit-pipeline__total strong,
.cockpit-pipeline__total small {
  display: block;
}
.cockpit-pipeline__total span,
.cockpit-pipeline__total small {
  color: #718078;
  font-size: 12px;
}
.cockpit-pipeline__total strong {
  margin-top: 2px;
  color: #172a23;
  font-size: clamp(28px, 2.25vw, 38px);
  font-weight: 760;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;
}
.cockpit-pipeline__bar {
  height: 15px;
  display: flex;
  overflow: hidden;
  margin-top: 13px;
  border-radius: 4px;
  background: #eef2f0;
}
.cockpit-pipeline__bar span + span {
  border-left: 2px solid #fff;
}
.is-estimate {
  background: #aeb9b4;
}
.is-oral_quote {
  background: #7e9e92;
}
.is-formal_quote {
  background: #326d5b;
}
.cockpit-pipeline__legend {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  margin-top: 10px;
}
.cockpit-pipeline__legend article {
  min-width: 0;
  padding: 8px 9px;
  border: 1px solid #e0e7e3;
  border-radius: 6px;
  background: #f7f9f8;
}
.cockpit-pipeline__legend header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #66766e;
  font-size: 11px;
}
.cockpit-pipeline__legend i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}
.cockpit-pipeline__legend strong,
.cockpit-pipeline__legend small {
  display: block;
}
.cockpit-pipeline__legend strong {
  margin-top: 4px;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
}
.cockpit-pipeline__legend small {
  color: #718078;
  font-size: 10px;
}
.cockpit-pipeline__risks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-top: 11px;
  padding: 9px 0;
  border-radius: 6px;
  background: #fbf0df;
}
.cockpit-pipeline__risks div {
  text-align: center;
}
.cockpit-pipeline__risks div + div {
  border-left: 1px solid rgb(179 119 49 / 24%);
}
.cockpit-pipeline__risks strong,
.cockpit-pipeline__risks span {
  display: block;
}
.cockpit-pipeline__risks strong {
  color: #85571f;
  font-size: 17px;
}
.cockpit-pipeline__risks span {
  color: #8b6a42;
  font-size: 10px;
}
</style>
