<template>
  <div class="management-dashboard operations-surface">
    <AppPageHeader
      title="经营与过程看板"
      description="先识别漏斗风险，再查看团队动作与需要介入的重要客户"
    />

    <el-card class="management-dashboard__filters" shadow="never">
      <div class="management-dashboard__filter-row">
        <strong class="management-dashboard__filter-label">统计范围</strong>
        <el-select
          v-model="filters.ownerId"
          clearable
          placeholder="全部下辖人员"
          aria-label="统计人员"
          @change="applyFilters"
        >
          <el-option
            v-for="member in members"
            :key="member.id"
            :label="member.displayName"
            :value="member.id"
          />
        </el-select>
        <el-select
          v-model="filters.salesRegionId"
          clearable
          placeholder="全部销售大区"
          aria-label="销售大区"
          @change="applyFilters"
        >
          <el-option
            v-for="region in regions"
            :key="region.id"
            :label="region.name"
            :value="region.id"
          />
        </el-select>
        <el-select
          v-if="activeTab !== 'team' && activeTab !== 'expenses'"
          v-model="filters.productLine"
          clearable
          placeholder="全部产品线"
          aria-label="产品线"
          @change="applyFilters"
        >
          <el-option
            v-for="option in productLines"
            :key="option.name"
            :label="option.label"
            :value="option.name"
          />
        </el-select>
        <el-button :loading="loading" @click="reload">刷新</el-button>
      </div>
      <small>{{ filterHint }}</small>
    </el-card>

    <section class="management-dashboard__body" aria-label="经营看板">
      <el-tabs v-model="activeTab" @tab-change="loadActiveTab">
        <el-tab-pane label="管理概览" name="overview" />
        <el-tab-pane label="商机经营" name="pipeline" />
        <el-tab-pane label="团队动态" name="team" />
        <el-tab-pane label="重点客户" name="customers" />
        <el-tab-pane label="团队费用" name="expenses" />
      </el-tabs>

      <AppQueryState :error="error" @retry="reload" />
      <div v-loading="loading" class="management-dashboard__content">
        <PipelineCompositionCard
          v-if="currentPool && !error"
          :pool="currentPool"
          title="当前有效商机池"
          subtitle="当前全部未结案商机 · 不受期间选择影响"
          class="management-dashboard__pool"
        />
        <section v-if="activeTab !== 'team'" class="management-dashboard__period">
          <strong>期间经营情况</strong>
          <ReportingPeriodSelector v-model="period" @update:model-value="applyFilters" />
        </section>
        <template v-if="!error">
          <ReportingOverviewPanel v-if="activeTab === 'overview' && overview" :data="overview" />
          <PipelineReportPanel v-else-if="activeTab === 'pipeline' && pipeline" :data="pipeline" />
          <TeamReportPanel
            v-else-if="activeTab === 'team' && team"
            :data="team"
            :filters="teamEffectiveFilters"
            @range-change="changeTeamRange"
          />
          <KeyCustomerReportPanel
            v-else-if="activeTab === 'customers' && keyCustomers"
            :data="keyCustomers"
          />
          <ExpenseReportPanel v-else-if="activeTab === 'expenses' && expenses" :data="expenses" />
        </template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import ExpenseReportPanel from '../components/reporting/ExpenseReportPanel.vue'
import KeyCustomerReportPanel from '../components/reporting/KeyCustomerReportPanel.vue'
import PipelineReportPanel from '../components/reporting/PipelineReportPanel.vue'
import ReportingOverviewPanel from '../components/reporting/ReportingOverviewPanel.vue'
import TeamReportPanel from '../components/reporting/TeamReportPanel.vue'
import PipelineCompositionCard from '../components/reporting/PipelineCompositionCard.vue'
import ReportingPeriodSelector from '../components/reporting/ReportingPeriodSelector.vue'
import {
  reportingToday,
  defaultReportingMonth,
  reportingPeriodRange,
  type ReportingPeriod,
} from '../components/reporting/reporting-period'
import {
  getExpenseReport,
  getKeyCustomerReport,
  getPipelineReport,
  getReportingOverview,
  getTeamReport,
  listDimensionOptions,
  listReportingMembers,
  listSalesRegions,
  type DimensionOption,
  type ExpenseReport,
  type KeyCustomerReport,
  type PipelineReport,
  type ReportingFilters,
  type ReportingMember,
  type ReportingOverview,
  type SalesRegion,
  type TeamReport,
} from '@crm/domain'

type TabName = 'overview' | 'pipeline' | 'team' | 'customers' | 'expenses'
const activeTab = ref<TabName>('overview')
const loading = ref(false)
const error = ref<string>()
const members = ref<ReportingMember[]>([])
const regions = ref<SalesRegion[]>([])
const productLines = ref<DimensionOption[]>([])
const overview = ref<ReportingOverview>()
const pipeline = ref<PipelineReport>()
const team = ref<TeamReport>()
const keyCustomers = ref<KeyCustomerReport>()
const expenses = ref<ExpenseReport>()

const today = reportingToday()
const period = ref<ReportingPeriod>({ kind: 'month', month: defaultReportingMonth(today) })
const initialRange = reportingPeriodRange(period.value, today)
const teamRange = ref<[string, string]>([today, today])
const filters = reactive<ReportingFilters>({
  start: initialRange[0],
  end: initialRange[1],
  ownerId: undefined,
  salesRegionId: undefined,
  productLine: undefined,
})
const currentPool = computed(() =>
  activeTab.value === 'overview'
    ? overview.value?.pipeline.pool
    : activeTab.value === 'pipeline'
      ? pipeline.value?.pool
      : undefined,
)
const teamEffectiveFilters = computed<ReportingFilters>(() => ({
  start: teamRange.value[0],
  end: teamRange.value[1],
  ownerId: filters.ownerId,
  salesRegionId: filters.salesRegionId,
}))
const filterHint = computed(() =>
  activeTab.value === 'team'
    ? '团队动态在页内按天/按周切换；销售大区按人员所属大区筛选，不改变组织树权限。'
    : '销售大区按人员所属大区筛选；人员、产品线条件在当前页面内生效，不改变组织树权限。',
)

onMounted(async () => {
  try {
    const [memberRows, regionRows, productRows] = await Promise.all([
      listReportingMembers(),
      listSalesRegions(),
      listDimensionOptions('product_line'),
    ])
    members.value = memberRows
    regions.value = regionRows
    productLines.value = productRows.filter((item) => item.isActive)
  } catch (loadError) {
    ElMessage.error(loadError instanceof Error ? loadError.message : '看板筛选项加载失败')
  }
  await reload()
})

let requestVersion = 0
async function reload() {
  const version = ++requestVersion
  const tab = activeTab.value
  if (tab !== 'team') {
    const range = reportingPeriodRange(period.value)
    filters.start = range[0]
    filters.end = range[1]
  }
  const query = { ...(tab === 'team' ? teamEffectiveFilters.value : filters) }
  loading.value = true
  error.value = undefined
  try {
    // 快速切换月份/页签时，只提交最后一次请求；不让旧响应覆盖新选择。
    if (tab === 'overview') {
      const result = await getReportingOverview(query)
      if (version === requestVersion) overview.value = result
    } else if (tab === 'pipeline') {
      const result = await getPipelineReport(query)
      if (version === requestVersion) pipeline.value = result
    } else if (tab === 'team') {
      const result = await getTeamReport(query)
      if (version === requestVersion) team.value = result
    } else if (tab === 'customers') {
      const result = await getKeyCustomerReport(query)
      if (version === requestVersion) keyCustomers.value = result
    } else {
      const result = await getExpenseReport(query)
      if (version === requestVersion) expenses.value = result
    }
  } catch (loadError) {
    if (version === requestVersion)
      error.value = loadError instanceof Error ? loadError.message : '管理看板加载失败'
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
function loadActiveTab() {
  void reload()
}
function changeTeamRange(range: [string, string]) {
  teamRange.value = range
  void reload()
}
function applyFilters() {
  void reload()
}
</script>

<style scoped>
.management-dashboard {
  min-width: 0;
  max-width: var(--crm-content-max-width);
  margin: 0 auto;
  padding: var(--crm-spacing-xl) 28px var(--crm-spacing-3xl);
}
.management-dashboard__filters {
  margin: 0 0 var(--crm-spacing-lg);
  border-color: var(--crm-color-border);
  box-shadow: var(--crm-shadow-card);
}
.management-dashboard__body {
  min-width: 0;
}
.management-dashboard__body :deep(.el-tabs__header) {
  padding: 0 16px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: #fff;
}
.management-dashboard__filter-label {
  padding-right: 8px;
  font-size: 13px;
}
.management-dashboard__filters :deep(.el-card__body) {
  padding: 13px 14px;
}
.management-dashboard__filter-row {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-sm);
  flex-wrap: wrap;
}
.management-dashboard__filter-row .el-select {
  width: 165px;
}
.management-dashboard__filters small {
  display: block;
  margin-top: 9px;
  color: var(--crm-color-text-tertiary);
  font-size: 12px;
}
.management-dashboard__content {
  min-height: 360px;
  padding-top: var(--crm-spacing-xs);
}
.management-dashboard__pool {
  margin-bottom: var(--crm-spacing-lg);
  border-top: 3px solid var(--crm-color-primary);
}
.management-dashboard__pool :deep(.pipeline-composition__header) {
  grid-template-columns: minmax(0, 1fr) auto;
}
.management-dashboard__pool :deep(.pipeline-composition__eyebrow) {
  font-size: 16px;
}
.management-dashboard__pool :deep(.pipeline-composition__legend) {
  gap: 0;
  border: 1px solid var(--crm-color-divider);
  border-radius: var(--crm-radius-xs);
  background: var(--crm-color-bg-subtle);
}
.management-dashboard__pool :deep(.pipeline-composition__item) {
  border: 0;
  border-radius: 0;
  background: transparent;
  padding: 10px 12px;
}
.management-dashboard__pool :deep(.pipeline-composition__item + .pipeline-composition__item) {
  border-left: 1px solid var(--crm-color-divider);
}
.management-dashboard__period {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
  flex-wrap: wrap;
  margin-bottom: var(--crm-spacing-md);
  padding: 14px 0 10px;
  border-bottom: 1px solid var(--crm-color-border-strong);
}
.management-dashboard__period > strong {
  font-size: 16px;
}
.management-dashboard__pool :deep(.pipeline-composition__item) {
  display: flex;
  flex-wrap: wrap;
}
.management-dashboard__pool :deep(.pipeline-composition__item-value) {
  display: flex;
  gap: 6px;
  align-items: baseline;
  margin-left: auto;
}
.management-dashboard__body :deep(.el-tabs__nav-wrap::after) {
  display: none;
}
</style>
