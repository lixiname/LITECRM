<template>
  <section class="cockpit-panel">
    <header class="cockpit-panel__head">
      <div>
        <h2>大区商机结构</h2>
        <p>按人员所属大区统计当前有效商机</p>
      </div>
      <span class="cockpit-panel__value">{{ rows.length }} 个大区</span>
    </header>
    <div class="cockpit-panel__body cockpit-regions">
      <div v-if="rows.length" class="cockpit-regions__list">
        <article v-for="row in rows.slice(0, 6)" :key="row.salesRegionId ?? 'none'">
          <header>
            <strong>{{ row.salesRegionName }}</strong>
            <span>{{ compactMoney(row.openAmount) }}</span>
          </header>
          <div><i :style="{ width: `${barWidth(row.openAmount)}%` }" /></div>
          <small>{{ row.openCount }} 个商机 · {{ row.stagnantCount }} 个停滞</small>
        </article>
      </div>
      <div v-else class="cockpit-empty">当前范围没有开放商机</div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PipelineRegionRow } from '@crm/domain'

const props = defineProps<{ rows: PipelineRegionRow[] }>()
const maxAmount = computed(() => Math.max(0, ...props.rows.map((item) => item.openAmount)))
function barWidth(value: number): number {
  return maxAmount.value ? Math.max(3, Math.round((value / maxAmount.value) * 100)) : 0
}
function compactMoney(value: number): string {
  if (value >= 100_000_000) return `¥${(value / 100_000_000).toFixed(2)}亿`
  if (value >= 10_000) return `¥${(value / 10_000).toFixed(value >= 1_000_000 ? 0 : 1)}万`
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
</script>

<style scoped>
.cockpit-regions__list {
  display: grid;
  gap: 10px;
}
.cockpit-regions article header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
}
.cockpit-regions article header span {
  font-variant-numeric: tabular-nums;
}
.cockpit-regions article > div {
  height: 7px;
  overflow: hidden;
  margin-top: 5px;
  border-radius: 4px;
  background: #e9efec;
}
.cockpit-regions article i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #397361;
}
.cockpit-regions article small {
  display: block;
  margin-top: 3px;
  color: #718078;
  font-size: 10px;
}
</style>
