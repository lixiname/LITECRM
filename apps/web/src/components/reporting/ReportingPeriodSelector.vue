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
      <template #footer><el-button text @click="years += 1">显示更早年份</el-button></template>
    </el-select>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { reportingMonthGroups, reportingToday, type ReportingPeriod } from './reporting-period'
const props = defineProps<{ modelValue: ReportingPeriod }>()
const emit = defineEmits<{ 'update:modelValue': [value: ReportingPeriod] }>()
const years = ref(3)
const groups = computed(() => {
  const today = reportingToday()
  const selectedYears =
    props.modelValue.kind === 'month'
      ? Number(today.slice(0, 4)) - Number(props.modelValue.month.slice(0, 4)) + 1
      : 0
  return reportingMonthGroups(today, Math.max(years.value, selectedYears))
})
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
