<template>
  <div class="week-view">
    <van-nav-bar :title="weekLabel" />
    <div class="week-view__nav">
      <van-icon name="arrow-left" size="18" @click="shiftWeek(-1)" />
      <span class="week-view__thisweek" @click="goToday">本周</span>
      <van-icon name="arrow" size="18" @click="shiftWeek(1)" />
    </div>

    <van-loading v-if="loading" class="week-view__loading" size="24" />
    <van-empty v-else-if="error" :description="error">
      <van-button size="small" type="primary" @click="reload">重新加载</van-button>
    </van-empty>

    <template v-else>
      <section v-if="view?.overdue.length" class="overdue-panel">
        <div class="overdue-panel__title">逾期待执行 · {{ view.overdue.length }}</div>
        <div
          v-for="action in view.overdue"
          :key="action.id"
          class="plan-row plan-row--overdue"
          @click="executePlan(action)"
        >
          <div>
            <span class="plan-row__kind">{{ planLabel(action.planKind) }}</span>
            <strong>{{ action.customerName }}</strong>
            <span>{{ action.content }}</span>
            <small>{{ formatTime(action.plannedAt) }}</small>
          </div>
          <van-button v-if="canWrite" size="mini" plain @click.stop="openReschedule(action)">
            改期
          </van-button>
        </div>
      </section>

      <div class="week-view__days">
        <article
          v-for="day in days"
          :key="day.date"
          class="day-card"
          :class="{ 'day-card--today': day.isToday }"
        >
          <header class="day-card__head">
            <div>
              <strong>{{ day.weekday }}</strong>
              <van-tag v-if="day.isToday" plain type="primary">今天</van-tag>
            </div>
            <span>{{ day.monthDay }}</span>
          </header>

          <section v-if="day.pendingPlans.length" class="day-card__section">
            <div class="day-card__section-title">
              <span>待执行</span><small>{{ day.pendingPlans.length }}</small>
            </div>
            <div
              v-for="action in day.pendingPlans"
              :key="action.id"
              class="plan-row"
              @click="executePlan(action)"
            >
              <div>
                <span class="plan-row__kind">{{ planLabel(action.planKind) }}</span>
                <strong>{{ action.customerName }}</strong>
                <span>{{ action.content }}</span>
                <small>{{ timeOnly(action.plannedAt) }}</small>
              </div>
              <van-button v-if="canWrite" size="mini" plain @click.stop="openReschedule(action)">
                改期
              </van-button>
            </div>
          </section>

          <section v-if="day.actualRecords.length" class="day-card__section">
            <div class="day-card__section-title">
              <span>已发生</span><small>{{ day.actualRecords.length }}</small>
            </div>
            <button
              v-for="record in day.actualRecords"
              :key="`${record.type}-${record.id}`"
              type="button"
              class="record-row"
              :class="{ 'record-row--complaint': record.type.startsWith('complaint_') }"
              @click="openActualRecord(record)"
            >
              <div class="record-row__head">
                <span>{{ recordLabel(record.type) }}</span>
                <small>{{ timeOnly(record.occurredAt) }}</small>
              </div>
              <strong>{{ record.customerName }}</strong>
              <span>{{ record.summary }}</span>
              <small>{{ record.sourcePlanId ? '来自计划' : '直接记录' }}</small>
            </button>
          </section>

          <details v-if="day.closedPlans.length" class="day-card__closed">
            <summary>已结束计划 {{ day.closedPlans.length }}</summary>
            <div
              v-for="action in day.closedPlans"
              :key="action.id"
              class="closed-row"
              :class="{ 'closed-row--clickable': action.status === 'completed' }"
              @click="openClosedPlan(action)"
            >
              <span>{{ timeOnly(action.plannedAt) }} · {{ planLabel(action.planKind) }}</span>
              <strong>{{ action.customerName }}</strong>
              <small>{{ action.status === 'completed' ? '已执行' : action.cancelReason }}</small>
            </div>
          </details>

          <div v-if="!day.hasContent" class="day-card__empty">当天还没有安排或记录</div>
          <div v-if="canWrite" class="day-card__add" @click="goQuickAdd(day.date)">
            ＋ 记录当日实际
          </div>
        </article>
      </div>
    </template>

    <van-popup v-model:show="commandSheet.visible" position="bottom" round>
      <div class="command-sheet">
        <h3>计划改期</h3>
        <van-field v-model="commandSheet.plannedAt" label="新日期" type="date" required />
        <div class="command-sheet__actions">
          <van-button block @click="commandSheet.visible = false">返回</van-button>
          <van-button block type="primary" :loading="commandSheet.saving" @click="submitReschedule">
            确认改期
          </van-button>
        </div>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  getWeekView,
  rescheduleSalesPlan,
  useAuthStore,
  useQuery,
  type SalesPlan,
  type SalesPlanKind,
} from '@crm/domain'
import {
  actualRecordRoute,
  buildMobileWeekDays,
  localDate,
  salesPlanExecutionRoute,
  type MobileActualRecord,
} from '../libs/sales-workbench'

const router = useRouter()
const auth = useAuthStore()
const canWrite = computed(() => auth.hasAbility('customer.write'))
const today = new Date()
const todayText = localDate(today)
const weekOffset = ref(0)
const range = computed(() => {
  const monday = new Date(today)
  const day = monday.getDay() || 7
  monday.setDate(today.getDate() - day + 1 + weekOffset.value * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday: localDate(monday), sunday: localDate(sunday) }
})
const weekLabel = computed(() => {
  const start = new Date(`${range.value.monday}T00:00:00`)
  const end = new Date(`${range.value.sunday}T00:00:00`)
  return `${start.getMonth() + 1}/${start.getDate()} — ${end.getMonth() + 1}/${end.getDate()}`
})
const {
  data: view,
  loading,
  error,
  reload,
} = useQuery('mobile:week-view', () => getWeekView(range.value.monday, range.value.sunday))
const days = computed(() => buildMobileWeekDays(range.value.monday, todayText, view.value))

watch(weekOffset, () => void reload())

const selectedAction = ref<SalesPlan>()
const commandSheet = reactive({ visible: false, plannedAt: '', saving: false })

function shiftWeek(value: number) {
  weekOffset.value += value
}
function goToday() {
  weekOffset.value = 0
}
function executePlan(action: SalesPlan) {
  if (canWrite.value) void router.push(salesPlanExecutionRoute(action))
}
function openReschedule(action: SalesPlan) {
  selectedAction.value = action
  commandSheet.plannedAt = localDate(new Date(action.plannedAt))
  commandSheet.visible = true
}
async function submitReschedule() {
  const action = selectedAction.value
  if (!action || !commandSheet.plannedAt) return showToast('请选择新的计划日期')
  commandSheet.saving = true
  try {
    await rescheduleSalesPlan(
      action.id,
      action.version,
      new Date(`${commandSheet.plannedAt}T00:00:00`).toISOString(),
    )
    showToast('计划已改期')
    commandSheet.visible = false
    await reload()
  } catch (commandError) {
    showToast(commandError instanceof Error ? commandError.message : '改期失败')
  } finally {
    commandSheet.saving = false
  }
}
function goQuickAdd(date: string) {
  void router.push({ path: '/quick-add', query: { date } })
}
function openActualRecord(record: MobileActualRecord) {
  const plan = record.sourcePlanId
    ? view.value?.plans.find((item) => item.id === record.sourcePlanId)
    : undefined
  void router.push(actualRecordRoute(record, plan))
}
function openClosedPlan(action: SalesPlan) {
  if (action.status !== 'completed') return
  const record = [
    ...(view.value?.businessRecords ?? []),
    ...(view.value?.complaintRecords ?? []),
  ].find((item) => item.sourcePlanId === action.id)
  if (!record) return showToast('该计划的执行事实不在当前周视图范围内')
  void router.push(actualRecordRoute(record, action))
}
function planLabel(kind: SalesPlanKind): string {
  return {
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机推进',
    complaint_follow_up: '客诉处理',
  }[kind]
}
function recordLabel(type: MobileActualRecord['type']): string {
  return {
    opportunity_created: '发现商机',
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机推进',
    opportunity_quote: '独立报价',
    complaint_registered: '客诉登记',
    complaint_follow_up: '客诉处理',
  }[type]
}
function timeOnly(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.week-view__nav,
.day-card__head,
.day-card__section-title,
.record-row__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-sm);
}
.week-view__nav {
  padding: var(--crm-spacing-sm) var(--crm-spacing-lg);
  border-bottom: 1px solid var(--crm-color-border);
  background: var(--crm-color-bg-card);
}
.week-view__thisweek,
.day-card__add {
  color: var(--crm-color-primary);
  font-weight: 600;
}
.week-view__loading {
  display: block;
  margin: var(--crm-spacing-xl) auto;
}
.overdue-panel {
  margin: var(--crm-spacing-sm);
  padding: var(--crm-spacing-md);
  border: 1px solid var(--crm-color-danger);
  border-radius: var(--crm-radius-md);
  background: #fff1f0;
}
.overdue-panel__title {
  margin-bottom: var(--crm-spacing-sm);
  color: var(--crm-color-danger);
  font-weight: 700;
}
.week-view__days {
  display: grid;
  gap: var(--crm-spacing-sm);
  padding: var(--crm-spacing-sm);
}
.day-card {
  overflow: hidden;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.day-card--today {
  border-color: var(--crm-color-primary);
}
.day-card__head,
.day-card__section,
.day-card__closed,
.day-card__empty,
.day-card__add {
  padding: var(--crm-spacing-sm) var(--crm-spacing-md);
}
.day-card__head {
  border-bottom: 1px solid var(--crm-color-border);
  background: var(--crm-color-bg-page);
}
.day-card__head > div {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-xs);
}
.day-card__section + .day-card__section {
  border-top: 1px solid var(--crm-color-border);
}
.day-card__section-title {
  margin-bottom: var(--crm-spacing-xs);
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
  font-weight: 600;
}
.plan-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: var(--crm-spacing-sm);
  align-items: center;
  padding: var(--crm-spacing-sm) 0;
}
.plan-row + .plan-row,
.record-row + .record-row {
  border-top: 1px dashed var(--crm-color-border);
}
.plan-row > div,
.record-row {
  display: grid;
  gap: 3px;
}
.plan-row--overdue {
  color: var(--crm-color-danger);
}
.plan-row__kind {
  width: fit-content;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
  background: var(--crm-color-primary);
  font-size: 12px;
}
.plan-row small,
.record-row small,
.closed-row small,
.day-card__empty {
  color: var(--crm-color-text-secondary);
}
.record-row {
  width: 100%;
  padding: var(--crm-spacing-sm);
  border: 0;
  border-left: 3px solid var(--crm-color-success);
  background: var(--crm-color-bg-page);
  color: inherit;
  text-align: left;
}
.record-row--complaint {
  border-left-color: var(--crm-color-danger);
}
.day-card__closed {
  border-top: 1px solid var(--crm-color-border);
  color: var(--crm-color-text-secondary);
}
.closed-row {
  display: grid;
  gap: 2px;
  padding: var(--crm-spacing-xs) 0;
  filter: grayscale(1);
  opacity: 0.62;
}
.closed-row--clickable {
  cursor: pointer;
}
.day-card__add {
  border-top: 1px solid var(--crm-color-border);
  text-align: center;
}
.command-sheet {
  padding: var(--crm-spacing-lg);
}
.command-sheet h3 {
  margin-top: 0;
  text-align: center;
}
.command-sheet__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--crm-spacing-sm);
  margin-top: var(--crm-spacing-lg);
}
</style>
