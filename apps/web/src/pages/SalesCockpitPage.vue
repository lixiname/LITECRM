<template>
  <main ref="cockpitElement" class="sales-cockpit" :class="{ 'is-fullscreen': isFullscreen }">
    <header class="sales-cockpit__hero">
      <div class="sales-cockpit__brand">
        <span aria-hidden="true">L</span>
        <div><strong>LITECRM</strong><small>INDUSTRIAL SALES</small></div>
      </div>
      <div class="sales-cockpit__title">
        <h1>销售经营驾驶舱</h1>
        <p>客户资产 · 有效商机 · 销售行动 · 过程风险</p>
      </div>
      <div class="sales-cockpit__actions">
        <el-button plain @click="router.push('/management')">进入经营分析</el-button>
        <el-button plain @click="toggleFullscreen">
          {{ isFullscreen ? '退出展示' : '展示模式' }}
        </el-button>
        <el-button :loading="loading" type="primary" @click="reload">刷新</el-button>
      </div>
    </header>

    <section class="sales-cockpit__scope" aria-label="统计范围">
      <div class="sales-cockpit__scope-copy">
        <strong>{{ scopeLabel }}</strong>
        <span>{{ rangeDescription }}</span>
      </div>
      <div class="sales-cockpit__filters">
        <ReportingPeriodSelector v-model="period" @update:model-value="reload" />
        <el-select
          v-model="ownerId"
          clearable
          placeholder="全部下辖人员"
          aria-label="统计人员"
          @change="reload"
        >
          <el-option
            v-for="member in members"
            :key="member.id"
            :label="member.displayName"
            :value="member.id"
          />
        </el-select>
        <el-select
          v-model="salesRegionId"
          clearable
          placeholder="全部销售大区"
          aria-label="销售大区"
          @change="reload"
        >
          <el-option
            v-for="region in regions"
            :key="region.id"
            :label="region.name"
            :value="region.id"
          />
        </el-select>
        <el-select
          v-model="productLine"
          clearable
          placeholder="全部产品线"
          aria-label="产品线"
          @change="reload"
        >
          <el-option
            v-for="option in productLines"
            :key="option.name"
            :label="option.label"
            :value="option.name"
          />
        </el-select>
      </div>
    </section>

    <AppQueryState :error="error" @retry="reload" />
    <div v-loading="loading" class="sales-cockpit__content">
      <template v-if="pipeline && team && keyCustomers && expenses && !error">
        <div class="sales-cockpit__grid">
          <div class="sales-cockpit__column sales-cockpit__left">
            <CockpitRegionPanel :rows="pipeline.byRegion" />
            <CockpitProcessPanel
              :flow="pipeline.flow"
              :team="team"
              :expense-amount="expenses.total.amount"
              :period-label="periodLabel"
            />
          </div>
          <div class="sales-cockpit__center">
            <CockpitMetricStrip :metrics="metrics" />
            <CockpitPipelinePanel :pool="pipeline.pool" />
          </div>
          <div class="sales-cockpit__column sales-cockpit__right">
            <CockpitTeamPanel :rows="team.members" />
            <CockpitAttentionPanel
              :rows="keyCustomers.items"
              :total-count="keyCustomers.totalCount"
              :attention-count="keyCustomers.attentionCount"
            />
          </div>
        </div>

        <footer class="sales-cockpit__foot">
          <span>当前存量与期间发生严格分区；金额取商机当前有效金额。</span>
          <span>CRM 仅呈现销售过程；订单、出货、回款及利润待 ERP 数据接通后纳入。</span>
          <span>更新于 {{ updatedAt }}</span>
        </footer>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import AppQueryState from '../components/AppQueryState.vue'
import CockpitAttentionPanel from '../components/cockpit/CockpitAttentionPanel.vue'
import CockpitMetricStrip, {
  type CockpitMetric,
} from '../components/cockpit/CockpitMetricStrip.vue'
import CockpitPipelinePanel from '../components/cockpit/CockpitPipelinePanel.vue'
import CockpitProcessPanel from '../components/cockpit/CockpitProcessPanel.vue'
import CockpitRegionPanel from '../components/cockpit/CockpitRegionPanel.vue'
import CockpitTeamPanel from '../components/cockpit/CockpitTeamPanel.vue'
import ReportingPeriodSelector from '../components/reporting/ReportingPeriodSelector.vue'
import {
  defaultReportingMonth,
  reportingPeriodRange,
  reportingToday,
  type ReportingPeriod,
} from '../components/reporting/reporting-period'
import {
  getExpenseReport,
  getKeyCustomerReport,
  getPipelineReport,
  getTeamReport,
  listDimensionOptions,
  listReportingMembers,
  listSalesRegions,
  type DimensionOption,
  type ExpenseReport,
  type KeyCustomerReport,
  type PipelineReport,
  type ReportingMember,
  type SalesRegion,
  type TeamReport,
} from '@crm/domain'
import '../styles/cockpit.css'

const router = useRouter()
const cockpitElement = ref<HTMLElement>()
const loading = ref(false)
const error = ref<string>()
const isFullscreen = ref(false)
const updatedAt = ref('—')
const members = ref<ReportingMember[]>([])
const regions = ref<SalesRegion[]>([])
const productLines = ref<DimensionOption[]>([])
const ownerId = ref<string>()
const salesRegionId = ref<string>()
const productLine = ref<string>()
const today = reportingToday()
const period = ref<ReportingPeriod>({ kind: 'month', month: defaultReportingMonth(today) })
const pipeline = ref<PipelineReport>()
const team = ref<TeamReport>()
const keyCustomers = ref<KeyCustomerReport>()
const expenses = ref<ExpenseReport>()

const selectedRange = computed(() => reportingPeriodRange(period.value))
const periodLabel = computed(() => {
  if (period.value.kind === 'this-week') return '本周'
  if (period.value.kind === 'last-week') return '上周'
  const monthValue =
    period.value.kind === 'month' ? period.value.month : defaultReportingMonth(today)
  const [year, month] = monthValue.split('-')
  return `${year}年${Number(month)}月`
})
const scopeLabel = computed(() => {
  const owner = members.value.find((item) => item.id === ownerId.value)?.displayName
  const region = regions.value.find((item) => item.id === salesRegionId.value)?.name
  return [region, owner].filter(Boolean).join(' · ') || '全部可见销售范围'
})
const rangeDescription = computed(
  () =>
    `当前存量截至 ${pipeline.value?.pool.asOf ?? today} · 期间数据 ${selectedRange.value[0]}—${selectedRange.value[1]}`,
)
const formalBucket = computed(() =>
  pipeline.value?.pool.buckets.find((item) => item.key === 'formal_quote'),
)
const metrics = computed<CockpitMetric[]>(() => {
  if (!pipeline.value) return []
  const pool = pipeline.value.pool
  const flow = pipeline.value.flow
  return [
    {
      label: '有效商机总额',
      scope: '当前',
      value: compactMoney(pool.totalAmount),
      hint: `${pool.totalCount} 个开放商机`,
    },
    {
      label: '正式报价金额',
      scope: '当前',
      value: compactMoney(formalBucket.value?.amount ?? 0),
      hint: `占有效池 ${percentage(formalBucket.value?.amount ?? 0, pool.totalAmount)}%`,
    },
    {
      label: '停滞商机',
      scope: '当前',
      value: compactMoney(pool.health.stagnantAmount),
      hint: `${pool.health.stagnantCount} 个 · 需要管理关注`,
      risk: pool.health.stagnantCount > 0,
    },
    {
      label: '行动风险',
      scope: '当前',
      value: String(pool.health.overdueActionCount),
      hint: `行动逾期 · 另有 ${pool.health.noNextActionCount} 个无下一步`,
      risk: pool.health.overdueActionCount + pool.health.noNextActionCount > 0,
    },
    {
      label: '新增商机',
      scope: '本期',
      scopeTone: 'flow',
      value: compactMoney(flow.created.amount),
      hint: `${flow.created.count} 个${flow.created.missingAmountCount ? ` · ${flow.created.missingAmountCount} 个金额待确认` : ''}`,
    },
    {
      label: '确认成交',
      scope: '本期',
      scopeTone: 'flow',
      value: compactMoney(flow.won.amount),
      hint: `${flow.won.count} 个 · 结案赢率 ${flow.closedWinRate === null ? '暂无样本' : `${(flow.closedWinRate * 100).toFixed(1)}%`}`,
    },
  ]
})

let requestVersion = 0
onMounted(async () => {
  document.addEventListener('fullscreenchange', syncFullscreen)
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
    ElMessage.error(loadError instanceof Error ? loadError.message : '驾驶舱筛选项加载失败')
  }
  await reload()
})
onBeforeUnmount(() => document.removeEventListener('fullscreenchange', syncFullscreen))

async function reload() {
  const version = ++requestVersion
  const [start, end] = selectedRange.value
  const filters = {
    start,
    end,
    ownerId: ownerId.value,
    salesRegionId: salesRegionId.value,
    productLine: productLine.value,
  }
  loading.value = true
  error.value = undefined
  try {
    const [pipelineResult, teamResult, customerResult, expenseResult] = await Promise.all([
      getPipelineReport(filters),
      getTeamReport({ start, end, ownerId: ownerId.value, salesRegionId: salesRegionId.value }),
      getKeyCustomerReport(filters),
      getExpenseReport({ start, end, ownerId: ownerId.value, salesRegionId: salesRegionId.value }),
    ])
    if (version !== requestVersion) return
    pipeline.value = pipelineResult
    team.value = teamResult
    keyCustomers.value = customerResult
    expenses.value = expenseResult
    updatedAt.value = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (loadError) {
    if (version === requestVersion) {
      error.value = loadError instanceof Error ? loadError.message : '经营驾驶舱加载失败'
    }
  } finally {
    if (version === requestVersion) loading.value = false
  }
}
async function toggleFullscreen() {
  if (!document.fullscreenElement) await cockpitElement.value?.requestFullscreen()
  else await document.exitFullscreen()
}
function syncFullscreen() {
  isFullscreen.value = document.fullscreenElement === cockpitElement.value
}
function percentage(value: number, total: number): number {
  return total ? Math.round((value / total) * 100) : 0
}
function compactMoney(value: number): string {
  if (value >= 100_000_000) return `¥${(value / 100_000_000).toFixed(2)}亿`
  if (value >= 10_000) return `¥${(value / 10_000).toFixed(value >= 1_000_000 ? 0 : 1)}万`
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
</script>

<style scoped>
.sales-cockpit {
  min-width: 0;
  min-height: calc(100vh - var(--crm-header-height));
  background: radial-gradient(circle at 50% -20%, rgb(71 127 107 / 13%), transparent 34%), #edf2ef;
  color: #172a23;
}
.sales-cockpit.is-fullscreen {
  min-width: 1180px;
  min-height: 100vh;
  overflow: auto;
}
.sales-cockpit__hero {
  min-height: 70px;
  display: grid;
  grid-template-columns: minmax(220px, 1fr) auto minmax(360px, 1fr);
  align-items: center;
  gap: 22px;
  padding: 0 22px;
  color: #eef7f3;
  background: linear-gradient(115deg, #183c32, #245849 55%, #183c32);
  box-shadow: 0 6px 22px rgb(20 51 42 / 17%);
}
.sales-cockpit__brand,
.sales-cockpit__actions,
.sales-cockpit__filters {
  display: flex;
  align-items: center;
}
.sales-cockpit__brand {
  gap: 10px;
}
.sales-cockpit__brand > span {
  width: 32px;
  height: 32px;
  display: grid;
  place-items: center;
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 8px;
  color: #17392f;
  background: #d9ebe4;
  font-weight: 800;
}
.sales-cockpit__brand strong,
.sales-cockpit__brand small {
  display: block;
}
.sales-cockpit__brand strong {
  font-size: 13px;
}
.sales-cockpit__brand small {
  color: rgb(238 247 243 / 64%);
  font-size: 9px;
  letter-spacing: 0.12em;
}
.sales-cockpit__title {
  text-align: center;
}
.sales-cockpit__title h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 680;
  letter-spacing: 0.11em;
}
.sales-cockpit__title p {
  margin: 3px 0 0;
  color: rgb(238 247 243 / 70%);
  font-size: 10px;
  letter-spacing: 0.04em;
}
.sales-cockpit__actions {
  justify-content: flex-end;
  gap: 8px;
}
.sales-cockpit__actions :deep(.el-button.is-plain) {
  border-color: rgb(255 255 255 / 28%);
  color: #eef7f3;
  background: rgb(255 255 255 / 8%);
}
.sales-cockpit__actions :deep(.el-button--primary) {
  border-color: #d8ebe4;
  color: #1d4d3e;
  background: #d8ebe4;
}
.sales-cockpit__scope {
  max-width: 1680px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  margin: 0 auto;
  padding: 14px 22px 11px;
}
.sales-cockpit__scope-copy strong,
.sales-cockpit__scope-copy span {
  display: block;
}
.sales-cockpit__scope-copy strong {
  font-size: 14px;
}
.sales-cockpit__scope-copy span {
  margin-top: 2px;
  color: #687972;
  font-size: 10px;
}
.sales-cockpit__filters {
  justify-content: flex-end;
  gap: 8px;
  flex-wrap: wrap;
}
.sales-cockpit__filters > .el-select {
  width: 142px;
}
.sales-cockpit__content {
  min-height: 500px;
  max-width: 1680px;
  margin: 0 auto;
  padding: 0 22px 18px;
}
.sales-cockpit__foot {
  display: flex;
  justify-content: space-between;
  gap: 18px;
  padding: 10px 2px 0;
  color: #7b8982;
  font-size: 9px;
}
@media (max-width: 1500px) {
  .sales-cockpit__hero {
    grid-template-columns: minmax(150px, 1fr) auto minmax(300px, 1fr);
  }
}
@media (max-width: 1180px) {
  .sales-cockpit__hero {
    grid-template-columns: 1fr auto;
  }
  .sales-cockpit__title {
    display: none;
  }
  .sales-cockpit__scope {
    align-items: flex-start;
    flex-direction: column;
  }
  .sales-cockpit__filters {
    justify-content: flex-start;
  }
}
/* Ice-blue operating-room treatment, adapted from the visual reference. */
.sales-cockpit {
  --cockpit-ink: #123458;
  --cockpit-muted: #6381a0;
  --cockpit-blue: #187cf3;
  --cockpit-cyan: #20bddd;
  --cockpit-line: #c4dff4;
  color: var(--cockpit-ink);
  background:
    linear-gradient(rgb(131 182 219 / 6%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(131 182 219 / 6%) 1px, transparent 1px),
    radial-gradient(ellipse at 50% 25%, #fbfdff, #e7f3ff 58%, #d6eaff);
  background-size:
    30px 30px,
    30px 30px,
    auto;
}
.sales-cockpit.is-fullscreen {
  min-width: 0;
}
.sales-cockpit__hero {
  min-height: 82px;
  gap: 18px;
  padding: 0 24px;
  border-bottom: 1px solid #a6d5f6;
  color: var(--cockpit-ink);
  background: linear-gradient(180deg, #f8fcff, #e0f1ff);
  box-shadow: 0 3px 20px rgb(52 136 190 / 9%);
}
.sales-cockpit__brand > span {
  border-color: #b7e1ff;
  color: #fff;
  background: linear-gradient(145deg, #20bddd, #187cf3);
  box-shadow: 0 3px 10px rgb(24 124 243 / 18%);
}
.sales-cockpit__brand strong {
  color: #187cf3;
}
.sales-cockpit__brand small {
  color: var(--cockpit-muted);
}
.sales-cockpit__title {
  min-width: 390px;
  padding: 10px 48px 12px;
  clip-path: polygon(0 0, 100% 0, 92% 100%, 8% 100%);
  color: #fff;
  background: linear-gradient(180deg, #63b2fb, #147ee9 74%, #78c8ff);
}
.sales-cockpit__title h1 {
  font-size: 23px;
  font-weight: 750;
}
.sales-cockpit__title p {
  color: #e6f6ff;
}
.sales-cockpit__actions :deep(.el-button.is-plain) {
  border-color: #b7daf4;
  color: #286da8;
  background: rgb(255 255 255 / 66%);
}
.sales-cockpit__actions :deep(.el-button--primary) {
  border-color: #187cf3;
  color: #fff;
  background: #187cf3;
}
.sales-cockpit__scope {
  max-width: 1920px;
  border-bottom: 1px solid #c4dff4;
}
.sales-cockpit__scope-copy span {
  color: var(--cockpit-muted);
}
.sales-cockpit__content {
  max-width: 1920px;
  padding-top: 14px;
}
.sales-cockpit__grid {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(460px, 1.75fr) minmax(300px, 1.1fr);
  align-items: start;
  gap: 14px;
  margin-top: 0;
}
.sales-cockpit__column,
.sales-cockpit__center {
  min-width: 0;
  display: grid;
  gap: 14px;
}
.sales-cockpit__foot {
  color: var(--cockpit-muted);
  font-size: 10px;
}
/* The application sidebar consumes 236px outside the cockpit itself. */
@media (max-width: 1350px) {
  .sales-cockpit__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .sales-cockpit__center {
    grid-column: 1 / -1;
    grid-row: 1;
  }
}
@media (max-width: 760px) {
  .sales-cockpit__hero {
    display: flex;
    flex-wrap: wrap;
    padding: 12px;
  }
  .sales-cockpit__actions {
    margin-left: auto;
  }
  .sales-cockpit__scope,
  .sales-cockpit__content {
    padding-right: 12px;
    padding-left: 12px;
  }
  .sales-cockpit__grid {
    grid-template-columns: 1fr;
  }
  .sales-cockpit__center {
    grid-column: 1;
  }
  .sales-cockpit__foot {
    flex-wrap: wrap;
  }
}
</style>
