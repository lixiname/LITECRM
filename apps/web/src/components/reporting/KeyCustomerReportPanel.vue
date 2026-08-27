<template>
  <div class="key-panel">
    <div class="key-panel__toolbar">
      <el-radio-group v-model="attentionOnly">
        <el-radio-button :value="true">需要关注（{{ data.attentionCount }}）</el-radio-button>
        <el-radio-button :value="false">全部 S/A（{{ data.totalCount }}）</el-radio-button>
      </el-radio-group>
      <small>风险由客诉、行动逾期、无下一步、长期无动作和预计成交逾期实时派生</small>
    </div>
    <el-table
      :data="rows"
      border
      row-class-name="key-panel__row"
      @row-click="(row: KeyCustomerReportItem) => router.push(`/customers/${row.id}`)"
    >
      <el-table-column label="客户" min-width="230" fixed>
        <template #default="{ row }">
          <div class="key-panel__customer">
            <el-tag :type="(row as KeyCustomerReportItem).grade === 'S' ? 'danger' : 'warning'">
              {{ (row as KeyCustomerReportItem).grade }}
            </el-tag>
            <strong>{{ (row as KeyCustomerReportItem).name }}</strong>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="ownerName" label="负责人" width="110" />
      <el-table-column prop="salesRegionName" label="销售大区" width="110" />
      <el-table-column label="开放商机" width="110" align="right">
        <template #default="{ row }">{{ (row as KeyCustomerReportItem).openOpportunityCount }} 个</template>
      </el-table-column>
      <el-table-column label="商机金额" width="140" align="right">
        <template #default="{ row }">{{ money((row as KeyCustomerReportItem).openOpportunityAmount) }}</template>
      </el-table-column>
      <el-table-column label="最近活动" width="120">
        <template #default="{ row }">{{ dateText((row as KeyCustomerReportItem).lastActivityAt) }}</template>
      </el-table-column>
      <el-table-column label="关注原因" min-width="260">
        <template #default="{ row }">
          <div v-if="(row as KeyCustomerReportItem).reasons.length" class="key-panel__reasons">
            <el-tag
              v-for="reason in (row as KeyCustomerReportItem).reasons.slice(0, 3)"
              :key="reason"
              type="danger"
              effect="plain"
              size="small"
            >
              {{ reasonLabel(reason) }}
            </el-tag>
          </div>
          <el-tag v-else type="success" effect="plain">当前无异常</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import type { KeyCustomerReport, KeyCustomerReportItem } from '@crm/domain'

const props = defineProps<{ data: KeyCustomerReport }>()
const router = useRouter()
const attentionOnly = ref(true)
const rows = computed(() =>
  attentionOnly.value ? props.data.items.filter((item) => item.needsAttention) : props.data.items,
)
const labels: Record<string, string> = {
  unresolved_complaint: '未解决客诉',
  overdue_action: '行动逾期',
  no_pending_action: '商机无下一步',
  action_overdue: '商机行动逾期',
  inactive_30d: '商机 30 天无动作',
  expected_close_overdue: '预计成交逾期',
  customer_inactive_30d: '客户 30 天无活动',
}
function reasonLabel(reason: string): string {
  return labels[reason] ?? reason
}
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
function dateText(value: string | null): string {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '尚无活动'
}
</script>

<style scoped>
.key-panel {
  display: grid;
  gap: var(--crm-spacing-md);
}
.key-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
}
.key-panel__toolbar small {
  color: var(--crm-color-text-secondary);
}
.key-panel__customer,
.key-panel__reasons {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-xs);
  flex-wrap: wrap;
}
:deep(.key-panel__row) {
  cursor: pointer;
}
</style>
