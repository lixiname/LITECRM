<template>
  <div class="report-period" aria-label="期间统计周期">
    <el-button-group>
      <el-button
        :type="modelValue.kind === 'this-week' ? 'primary' : undefined"
        :aria-pressed="modelValue.kind === 'this-week'"
        @click="emit('update:modelValue', { kind: 'this-week' })"
        >本周</el-button
      >
      <el-button
        :type="modelValue.kind === 'last-week' ? 'primary' : undefined"
        :aria-pressed="modelValue.kind === 'last-week'"
        @click="emit('update:modelValue', { kind: 'last-week' })"
        >上周</el-button
      >
    </el-button-group>
    <el-select
      :model-value="modelValue.kind === 'month' ? modelValue.month : undefined"
      placeholder="选择月份"
      aria-label="选择统计月份"
      class="report-period__month"
      @change="(month: string) => emit('update:modelValue', { kind: 'month', month })"
    >
      <el-option-group v-for="group in groups" :key="group.year" :label="`${group.year}年`">
        <el-option
          v-for="month in group.months"
          :key="month.value"
          :label="month.label"
          :value="month.value"
        />
      </el-option-group>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { reportingMonthGroups, type ReportingPeriod } from './reporting-period'
defineProps<{ modelValue: ReportingPeriod }>()
const emit = defineEmits<{ 'update:modelValue': [value: ReportingPeriod] }>()
const groups = reportingMonthGroups()
</script>

<style scoped>
.report-period {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-sm);
}
.report-period__month {
  width: 160px;
}
</style>
