<template>
  <div class="management-dashboard">
    <AppPageHeader
      eyebrow="Management Overview"
      title="经营与过程看板"
      description="先识别漏斗风险，再查看团队动作与需要介入的重要客户"
    />

    <el-card class="management-dashboard__filters" shadow="never">
      <div class="management-dashboard__filter-row">
        <el-button-group>
          <el-button @click="setCurrentWeek">本周</el-button>
          <el-button @click="setCurrentMonth">本月</el-button>
        </el-button-group>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          range-separator="至"
          @change="applyFilters"
        />
        <el-select
          v-model="filters.ownerId"
          clearable
          placeholder="全部下辖人员"
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
          v-model="filters.productLine"
          clearable
          placeholder="全部产品线"
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
      <small
        >当前商机池按今日存量统计，不受日期范围影响；日期用于期间推进、成交、团队活动和费用。销售大区和产品线仅影响商机与重点客户。</small
      >
    </el-card>

    <el-card class="management-dashboard__body" shadow="never">
      <el-tabs v-model="activeTab" @tab-change="loadActiveTab">
        <el-tab-pane label="管理概览" name="overview" />
        <el-tab-pane label="商机经营" name="pipeline" />
        <el-tab-pane label="团队动态" name="team" />
        <el-tab-pane label="重点客户" name="customers" />
        <el-tab-pane label="团队费用" name="expenses" />
      </el-tabs>

      <AppQueryState :error="error" @retry="reload" />
      <div v-if="!error" v-loading="loading" class="management-dashboard__content">
        <ReportingOverviewPanel v-if="activeTab === 'overview' && overview" :data="overview" />
        <PipelineReportPanel v-else-if="activeTab === 'pipeline' && pipeline" :data="pipeline" />
        <TeamReportPanel v-else-if="activeTab === 'team' && team" :data="team" :filters="filters" />
        <KeyCustomerReportPanel
          v-else-if="activeTab === 'customers' && keyCustomers"
          :data="keyCustomers"
        />
        <ExpenseReportPanel v-else-if="activeTab === 'expenses' && expenses" :data="expenses" />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import ExpenseReportPanel from '../components/reporting/ExpenseReportPanel.vue'
import KeyCustomerReportPanel from '../components/reporting/KeyCustomerReportPanel.vue'
import PipelineReportPanel from '../components/reporting/PipelineReportPanel.vue'
import ReportingOverviewPanel from '../components/reporting/ReportingOverviewPanel.vue'
import TeamReportPanel from '../components/reporting/TeamReportPanel.vue'
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

const today = new Date()
const dateRange = ref<[string, string]>([monthStart(today), localDate(today)])
const filters = reactive<ReportingFilters>({
  start: dateRange.value[0],
  end: dateRange.value[1],
  ownerId: undefined,
  salesRegionId: undefined,
  productLine: undefined,
})

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

async function reload() {
  loading.value = true
  error.value = undefined
  try {
    if (activeTab.value === 'overview') overview.value = await getReportingOverview(filters)
    else if (activeTab.value === 'pipeline') pipeline.value = await getPipelineReport(filters)
    else if (activeTab.value === 'team') team.value = await getTeamReport(filters)
    else if (activeTab.value === 'customers')
      keyCustomers.value = await getKeyCustomerReport(filters)
    else expenses.value = await getExpenseReport(filters)
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '管理看板加载失败'
  } finally {
    loading.value = false
  }
}
function loadActiveTab() {
  void reload()
}
function applyFilters() {
  if (!dateRange.value?.[0] || !dateRange.value?.[1]) return
  filters.start = dateRange.value[0]
  filters.end = dateRange.value[1]
  void reload()
}
function setCurrentMonth() {
  const current = new Date()
  dateRange.value = [monthStart(current), localDate(current)]
  applyFilters()
}
function setCurrentWeek() {
  const current = new Date()
  const monday = new Date(current)
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  dateRange.value = [localDate(monday), localDate(sunday)]
  applyFilters()
}
function localDate(date: Date): string {
  return date.toLocaleDateString('sv-SE')
}
function monthStart(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}
</script>

<style scoped>
.management-dashboard {
  min-width: 960px;
  max-width: var(--crm-content-max-width);
  margin: 0 auto;
  padding: var(--crm-spacing-xl) 28px var(--crm-spacing-3xl);
}
.management-dashboard__filters,
.management-dashboard__body {
  margin: 0 0 var(--crm-spacing-lg);
  border-color: var(--crm-color-border);
  box-shadow: var(--crm-shadow-card);
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
  font-size: 11px;
}
.management-dashboard__content {
  min-height: 360px;
  padding-top: var(--crm-spacing-xs);
}
.management-dashboard__body :deep(.el-card__body) {
  padding: 0 20px 22px;
}
.management-dashboard__body :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
  background: var(--crm-color-divider);
}
</style>
