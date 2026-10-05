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
      <div class="cockpit-pipeline__hero">
        <div class="cockpit-pipeline__satellite">
          <span>仅预估</span>
          <strong>{{ compactMoney(bucketAmount('estimate')) }}</strong>
          <small>{{ bucketCount('estimate') }} 个商机</small>
        </div>
        <div
          class="cockpit-pipeline__ring"
          role="img"
          :aria-label="`正式报价金额占有效商机池 ${formalShare}%`"
          :style="{ '--formal-share': `${formalShare}%` }"
        >
          <div class="cockpit-pipeline__ring-inner">
            <span>正式报价占比</span>
            <strong>{{ formalShare }}<small>%</small></strong>
            <em>{{ bucketCount('formal_quote') }} 个正式报价商机</em>
          </div>
        </div>
        <div class="cockpit-pipeline__satellite is-right">
          <span>口头报价</span>
          <strong>{{ compactMoney(bucketAmount('oral_quote')) }}</strong>
          <small>{{ bucketCount('oral_quote') }} 个商机</small>
        </div>
      </div>
      <div class="cockpit-pipeline__total">
        <span>当前有效商机总额</span>
        <strong>{{ money(pool.totalAmount) }}</strong>
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
const formalShare = computed(() => percent(bucketAmount('formal_quote')))
const compositionLabel = computed(() =>
  props.pool.buckets.map((item) => `${item.label}${percent(item.amount)}%`).join('，'),
)
function bucketAmount(key: string): number {
  return props.pool.buckets.find((item) => item.key === key)?.amount ?? 0
}
function bucketCount(key: string): number {
  return props.pool.buckets.find((item) => item.key === key)?.count ?? 0
}
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
  border-top: 3px solid #248ef2;
  background: radial-gradient(ellipse at 50% 42%, #e5f4ff, #f8fcff 66%, #fff);
}
.cockpit-pipeline__hero {
  min-height: 235px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 210px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  background: radial-gradient(ellipse at 50% 52%, rgb(92 180 251 / 20%), transparent 72%);
}
.cockpit-pipeline__satellite {
  min-width: 0;
  padding: 12px;
  border: 1px solid #cbe6fa;
  border-radius: 7px;
  background: linear-gradient(130deg, rgb(255 255 255 / 85%), rgb(222 241 255 / 65%));
}
.cockpit-pipeline__satellite.is-right {
  text-align: right;
}
.cockpit-pipeline__satellite span,
.cockpit-pipeline__satellite strong,
.cockpit-pipeline__satellite small {
  display: block;
}
.cockpit-pipeline__satellite span {
  color: #5e7f9e;
  font-size: 11px;
}
.cockpit-pipeline__satellite strong {
  margin: 5px 0;
  overflow: hidden;
  color: #247dcc;
  font-size: clamp(15px, 1.45vw, 23px);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cockpit-pipeline__satellite small {
  color: #6381a0;
  font-size: 10px;
}
.cockpit-pipeline__ring {
  width: 202px;
  height: 202px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: conic-gradient(#187cf3 var(--formal-share), #d2e8fa 0);
  box-shadow:
    0 8px 24px rgb(24 124 243 / 16%),
    0 0 0 7px rgb(160 216 255 / 35%);
}
.cockpit-pipeline__ring-inner {
  width: 174px;
  height: 174px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: radial-gradient(circle, #fff 58%, #e8f6ff);
  text-align: center;
}
.cockpit-pipeline__ring-inner span {
  color: #5a80a5;
  font-size: 12px;
}
.cockpit-pipeline__ring-inner strong {
  color: #167ce6;
  font-size: 46px;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.cockpit-pipeline__ring-inner strong small {
  font-size: 18px;
}
.cockpit-pipeline__ring-inner em {
  color: #078d85;
  font-size: 10px;
  font-style: normal;
}
.cockpit-pipeline__total {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 9px;
  padding-bottom: 8px;
  border-bottom: 1px solid #d9ebfa;
}
.cockpit-pipeline__total span,
.cockpit-pipeline__total strong,
.cockpit-pipeline__total small {
  display: block;
}
.cockpit-pipeline__total span,
.cockpit-pipeline__total small {
  color: #6381a0;
  font-size: 12px;
}
.cockpit-pipeline__total strong {
  color: #123458;
  font-size: clamp(23px, 2vw, 32px);
  font-weight: 760;
  letter-spacing: -0.045em;
  font-variant-numeric: tabular-nums;
}
.cockpit-pipeline__bar {
  height: 13px;
  display: flex;
  overflow: hidden;
  margin-top: 13px;
  border-radius: 4px;
  background: #e7f2fc;
}
.cockpit-pipeline__bar span + span {
  border-left: 2px solid #fff;
}
.is-estimate {
  background: #9bc5e8;
}
.is-oral_quote {
  background: #20bddd;
}
.is-formal_quote {
  background: #187cf3;
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
  border: 1px solid #d5e9f8;
  border-radius: 6px;
  background: rgb(255 255 255 / 72%);
}
.cockpit-pipeline__legend header {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #6381a0;
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
  color: #6381a0;
  font-size: 10px;
}
.cockpit-pipeline__risks {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin-top: 11px;
  padding: 9px 0;
  border-radius: 6px;
  background: #fff6e9;
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
@media (max-width: 680px) {
  .cockpit-pipeline__hero {
    grid-template-columns: 1fr 1fr;
  }
  .cockpit-pipeline__ring {
    grid-column: 1 / -1;
    grid-row: 1;
    justify-self: center;
  }
  .cockpit-pipeline__satellite.is-right {
    text-align: left;
  }
  .cockpit-pipeline__total {
    flex-wrap: wrap;
  }
}
</style>
