<template>
  <section class="cockpit-panel">
    <header class="cockpit-panel__head">
      <div>
        <h2>本期销售过程</h2>
        <p>实际发生与关键节点，不与当前商机池混算</p>
      </div>
      <span class="cockpit-panel__value">{{ periodLabel }}</span>
    </header>
    <div class="cockpit-panel__body cockpit-process">
      <div class="cockpit-process__actions">
        <article>
          <span>客户拜访</span><strong>{{ totals.visits }}</strong>
        </article>
        <article>
          <span>商机推进</span><strong>{{ totals.followUps }}</strong>
        </article>
        <article>
          <span>报价记录</span><strong>{{ totals.quotes }}</strong>
        </article>
        <article>
          <span>客诉处理</span><strong>{{ totals.complaints }}</strong>
        </article>
      </div>

      <div class="cockpit-process__nodes">
        <header><span>本期关键节点</span><small>独立事件计数，不表示同批转化</small></header>
        <div>
          <article>
            <strong>{{ flow.created.count }}</strong
            ><span>新建商机</span>
          </article>
          <article>
            <strong>{{ flow.firstQuoted.count }}</strong
            ><span>首次报价</span>
          </article>
          <article>
            <strong>{{ flow.firstFormalQuoted.count }}</strong
            ><span>首次正式报价</span>
          </article>
          <article>
            <strong>{{ flow.won.count }}</strong
            ><span>确认成交</span>
          </article>
        </div>
      </div>

      <footer>
        <span
          >实际业务记录 <b>{{ totals.actual }}</b></span
        >
        <span
          >完成计划 <b>{{ totals.completed }}</b></span
        >
        <span
          >已提交费用 <b>{{ compactMoney(expenseAmount) }}</b></span
        >
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PipelineReport, TeamReport } from '@crm/domain'

const props = defineProps<{
  flow: PipelineReport['flow']
  team: TeamReport
  expenseAmount: number
  periodLabel: string
}>()
const totals = computed(() =>
  props.team.members.reduce(
    (sum, item) => ({
      visits: sum.visits + item.visits,
      followUps: sum.followUps + item.opportunityFollowUps,
      quotes: sum.quotes + item.quotes,
      complaints: sum.complaints + item.complaintRecords,
      actual: sum.actual + item.actualRecordCount,
      completed: sum.completed + item.completedPlanCount,
    }),
    { visits: 0, followUps: 0, quotes: 0, complaints: 0, actual: 0, completed: 0 },
  ),
)
function compactMoney(value: number): string {
  if (value >= 100_000_000) return `¥${(value / 100_000_000).toFixed(2)}亿`
  if (value >= 10_000) return `¥${(value / 10_000).toFixed(value >= 1_000_000 ? 0 : 1)}万`
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
</script>

<style scoped>
.cockpit-process {
  display: grid;
  gap: 13px;
}
.cockpit-process__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}
.cockpit-process__actions article {
  padding: 8px 9px;
  border-radius: 6px;
  border: 1px solid #e1effa;
  background: linear-gradient(125deg, #fafdff, #e9f5ff);
}
.cockpit-process__actions span,
.cockpit-process__actions strong {
  display: block;
}
.cockpit-process__actions span {
  color: #6381a0;
  font-size: 10px;
}
.cockpit-process__actions strong {
  margin-top: 2px;
  font-size: 17px;
  font-variant-numeric: tabular-nums;
}
.cockpit-process__nodes {
  padding-top: 11px;
  border-top: 1px solid #d5e9f8;
}
.cockpit-process__nodes > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #6381a0;
  font-size: 11px;
}
.cockpit-process__nodes > header small {
  color: #7899b5;
  font-size: 9px;
}
.cockpit-process__nodes > div {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  margin-top: 8px;
}
.cockpit-process__nodes article {
  position: relative;
  padding: 7px 4px;
  border-radius: 5px;
  background: #e5f3ff;
  text-align: center;
}
.cockpit-process__nodes article:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -6px;
  width: 6px;
  height: 1px;
  background: #a6d5f6;
}
.cockpit-process__nodes strong,
.cockpit-process__nodes span {
  display: block;
}
.cockpit-process__nodes strong {
  font-size: 17px;
}
.cockpit-process__nodes span {
  color: #6381a0;
  font-size: 9px;
}
.cockpit-process footer {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  padding-top: 10px;
  border-top: 1px solid #d5e9f8;
  color: #6381a0;
  font-size: 10px;
}
.cockpit-process footer b {
  color: #123458;
}
</style>
