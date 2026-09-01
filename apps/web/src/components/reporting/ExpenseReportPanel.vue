<template>
  <div class="expense-panel">
    <section class="expense-panel__metrics">
      <ReportingMetricCard label="已提交费用" :value="money(data.total.amount)" tone="primary" />
      <ReportingMetricCard label="烟酒" :value="money(data.total.tobaccoAlcohol)" />
      <ReportingMetricCard label="礼品" :value="money(data.total.gifts)" />
      <ReportingMetricCard
        label="餐叙与娱乐招待"
        :value="money(data.total.dining + data.total.entertainment)"
      />
      <ReportingMetricCard
        label="未提交草稿"
        :value="`${data.total.draftDays} 条`"
        hint="草稿不计入费用总额"
        :tone="data.total.draftDays ? 'warning' : undefined"
      />
    </section>
    <el-card shadow="never">
      <template #header>下辖人员费用</template>
      <el-table :data="data.byOwner" border>
        <el-table-column prop="ownerName" label="人员" min-width="110" fixed />
        <el-table-column label="已提交合计" min-width="130" align="right">
          <template #default="{ row }">{{ money((row as ExpenseOwnerRow).amount) }}</template>
        </el-table-column>
        <el-table-column label="烟酒" min-width="110" align="right">
          <template #default="{ row }">{{
            money((row as ExpenseOwnerRow).tobaccoAlcohol)
          }}</template>
        </el-table-column>
        <el-table-column label="礼品" min-width="110" align="right">
          <template #default="{ row }">{{ money((row as ExpenseOwnerRow).gifts) }}</template>
        </el-table-column>
        <el-table-column label="餐叙" min-width="110" align="right">
          <template #default="{ row }">{{ money((row as ExpenseOwnerRow).dining) }}</template>
        </el-table-column>
        <el-table-column label="娱乐招待" min-width="120" align="right">
          <template #default="{ row }">{{
            money((row as ExpenseOwnerRow).entertainment)
          }}</template>
        </el-table-column>
        <el-table-column label="住宿" min-width="110" align="right">
          <template #default="{ row }">{{ money((row as ExpenseOwnerRow).lodging) }}</template>
        </el-table-column>
        <el-table-column prop="draftDays" label="草稿" width="90" align="right" />
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import type { ExpenseOwnerRow, ExpenseReport } from '@crm/domain'
import ReportingMetricCard from './ReportingMetricCard.vue'

defineProps<{ data: ExpenseReport }>()
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
</script>

<style scoped>
.expense-panel {
  display: grid;
  gap: var(--crm-spacing-md);
}
.expense-panel__metrics {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--crm-spacing-md);
}
</style>
