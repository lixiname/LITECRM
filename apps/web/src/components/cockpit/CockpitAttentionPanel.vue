<template>
  <section class="cockpit-panel">
    <header class="cockpit-panel__head">
      <div>
        <h2>需要管理介入</h2>
        <p>S/A 客户的客诉、行动和商机风险</p>
      </div>
      <span class="cockpit-panel__value">{{ attentionCount }} 项</span>
    </header>
    <div class="cockpit-panel__body cockpit-attention">
      <button
        v-for="customer in attentionRows"
        :key="customer.id"
        type="button"
        @click="router.push(`/customers/${customer.id}`)"
      >
        <span :class="['cockpit-attention__grade', `is-${customer.grade.toLowerCase()}`]">
          {{ customer.grade }}
        </span>
        <span class="cockpit-attention__copy">
          <strong>{{ customer.name }}</strong>
          <small>
            {{ customer.ownerName }} · {{ reasonLabel(customer.reasons[0]) }} ·
            {{ compactMoney(customer.openOpportunityAmount) }}
          </small>
        </span>
        <span class="cockpit-attention__tag">需介入</span>
      </button>
      <div v-if="!attentionRows.length" class="cockpit-empty">当前没有需要介入的 S/A 客户</div>
      <footer>
        <span>S/A 客户 {{ totalCount }} 家</span>
        <span>风险由业务事实实时派生，不由人工勾选</span>
      </footer>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { KeyCustomerReportItem } from '@crm/domain'

const props = defineProps<{
  rows: KeyCustomerReportItem[]
  totalCount: number
  attentionCount: number
}>()
const router = useRouter()
const attentionRows = computed(() => props.rows.filter((item) => item.needsAttention).slice(0, 5))
const labels: Record<string, string> = {
  unresolved_complaint: '存在未解决客诉',
  overdue_action: '存在逾期行动',
  no_pending_action: '开放商机缺少下一步',
  action_overdue: '商机行动已逾期',
  inactive_30d: '商机超过 30 天无动作',
  expected_close_overdue: '预计成交日已过',
  customer_inactive_30d: '客户超过 30 天无活动',
}
function reasonLabel(value?: string): string {
  return value ? (labels[value] ?? value) : '需要关注'
}
function compactMoney(value: number): string {
  if (value >= 100_000_000) return `¥${(value / 100_000_000).toFixed(2)}亿`
  if (value >= 10_000) return `¥${(value / 10_000).toFixed(value >= 1_000_000 ? 0 : 1)}万`
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
</script>

<style scoped>
.cockpit-attention {
  padding-top: 5px;
}
.cockpit-attention button {
  width: 100%;
  min-height: 50px;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border: 0;
  border-bottom: 1px solid #e2eef8;
  color: inherit;
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.cockpit-attention button:hover .cockpit-attention__copy strong {
  color: #187cf3;
}
.cockpit-attention__grade {
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border-radius: 5px;
  color: #7c4f1d;
  background: #f4e4c9;
  font-size: 11px;
  font-weight: 800;
}
.cockpit-attention__grade.is-a {
  color: #355d74;
  background: #e6eef3;
}
.cockpit-attention__copy {
  min-width: 0;
}
.cockpit-attention__copy strong,
.cockpit-attention__copy small {
  display: block;
}
.cockpit-attention__copy strong {
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cockpit-attention__copy small {
  margin-top: 2px;
  overflow: hidden;
  color: #6381a0;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cockpit-attention__tag {
  padding: 3px 6px;
  border-radius: 4px;
  color: #bb741e;
  background: #f8e9e7;
  font-size: 10px;
  white-space: nowrap;
}
.cockpit-attention footer {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding-top: 10px;
  color: #6381a0;
  font-size: 10px;
}
</style>
