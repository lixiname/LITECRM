<template>
  <section class="cockpit-panel">
    <header class="cockpit-panel__head">
      <div>
        <h2>团队执行概览</h2>
        <p>本期拜访、商机推进、报价和当前逾期</p>
      </div>
      <span class="cockpit-panel__value">{{ rows.length }} 人</span>
    </header>
    <div class="cockpit-panel__body cockpit-team">
      <div v-if="ranked.length" class="cockpit-team__list">
        <article v-for="(row, index) in ranked" :key="row.ownerId">
          <span class="cockpit-team__rank">{{ index + 1 }}</span>
          <div class="cockpit-team__identity">
            <strong>{{ row.ownerName }}</strong>
            <small>{{ row.salesRegionName ?? '未分配大区' }}</small>
          </div>
          <div class="cockpit-team__activity">
            <div>
              <i class="is-visit" :style="segmentStyle(row.visits)" />
              <i class="is-follow" :style="segmentStyle(row.opportunityFollowUps)" />
              <i class="is-quote" :style="segmentStyle(row.quotes)" />
            </div>
            <small>{{ row.actualRecordCount }} 条记录</small>
          </div>
          <span :class="['cockpit-team__risk', { 'is-risk': row.overdueCount }]">
            {{ row.overdueCount ? `${row.overdueCount} 逾期` : '无逾期' }}
          </span>
        </article>
      </div>
      <div v-else class="cockpit-empty">本期暂无团队业务记录</div>
      <footer>
        <span><i class="is-visit" />拜访</span>
        <span><i class="is-follow" />商机推进</span>
        <span><i class="is-quote" />报价</span>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TeamMemberReport } from '@crm/domain'

const props = defineProps<{ rows: TeamMemberReport[] }>()
const ranked = computed(() =>
  [...props.rows]
    .filter((item) => item.actualRecordCount || item.pendingCount || item.overdueCount)
    .sort(
      (a, b) =>
        b.actualRecordCount - a.actualRecordCount ||
        b.overdueCount - a.overdueCount ||
        a.ownerName.localeCompare(b.ownerName),
    )
    .slice(0, 7),
)
const maxActual = computed(() => Math.max(1, ...ranked.value.map((item) => item.actualRecordCount)))
function segmentStyle(value: number) {
  return { width: `${Math.max(value ? 3 : 0, (value / maxActual.value) * 100)}%` }
}
</script>

<style scoped>
.cockpit-team__list {
  display: grid;
}
.cockpit-team__list article {
  min-height: 42px;
  display: grid;
  grid-template-columns: 24px 100px minmax(120px, 1fr) 58px;
  align-items: center;
  gap: 9px;
  border-bottom: 1px solid #e2eef8;
}
.cockpit-team__rank {
  width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  color: #286da8;
  background: #e5f3ff;
  font-size: 10px;
  font-weight: 700;
}
.cockpit-team__identity strong,
.cockpit-team__identity small {
  display: block;
}
.cockpit-team__identity strong {
  font-size: 12px;
}
.cockpit-team__identity small,
.cockpit-team__activity small {
  color: #6381a0;
  font-size: 9px;
}
.cockpit-team__activity > div {
  height: 7px;
  display: flex;
  gap: 2px;
  overflow: hidden;
  border-radius: 3px;
}
.cockpit-team__activity i {
  min-width: 0;
}
.is-visit {
  background: #187cf3;
}
.is-follow {
  background: #20bddd;
}
.is-quote {
  background: #e1a153;
}
.cockpit-team__risk {
  color: #6381a0;
  font-size: 10px;
  text-align: right;
}
.cockpit-team__risk.is-risk {
  color: #bb741e;
  font-weight: 650;
}
.cockpit-team footer {
  display: flex;
  gap: 14px;
  margin-top: 10px;
  color: #6381a0;
  font-size: 10px;
}
.cockpit-team footer i {
  width: 7px;
  height: 7px;
  display: inline-block;
  margin-right: 4px;
  border-radius: 2px;
}
</style>
