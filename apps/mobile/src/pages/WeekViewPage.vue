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
            <small>{{ action.plannedAt }}</small>
          </div>
          <van-button v-if="canWrite" size="mini" plain @click.stop="openReschedule(action)">
            改期
          </van-button>
        </div>
      </section>

      <div class="view-switch" role="tablist" aria-label="计划视图">
        <button
          type="button"
          :class="{ 'is-active': viewMode === 'day' }"
          @click="viewMode = 'day'"
        >
          日程
        </button>
        <button
          type="button"
          :class="{ 'is-active': viewMode === 'week' }"
          @click="viewMode = 'week'"
        >
          周概览
        </button>
      </div>

      <div class="day-strip">
        <button
          v-for="day in days"
          :key="day.date"
          type="button"
          class="day-strip__item"
          :class="{
            'is-selected': day.date === selectedDate,
            'is-today': day.isToday,
          }"
          @click="selectDay(day.date)"
        >
          <span>{{ day.weekday.slice(1) }}</span>
          <strong>{{ day.monthDay.split('/')[1] }}</strong>
          <small>{{ day.pendingPlans.length }}待 · {{ day.actualRecords.length }}记</small>
        </button>
      </div>

      <article v-if="viewMode === 'day' && selectedDay" class="day-card day-card--selected">
        <header class="day-card__head">
          <van-icon name="arrow-left" @click="moveSelectedDay(-1)" />
          <div>
            <strong>{{ selectedDay.weekday }} · {{ selectedDay.monthDay }}</strong>
            <van-tag v-if="selectedDay.isToday" plain type="primary">今天</van-tag>
          </div>
          <van-icon name="arrow" @click="moveSelectedDay(1)" />
        </header>

        <section v-if="selectedDay.pendingPlans.length" class="day-card__section">
          <div class="day-card__section-title">
            <span>待执行计划</span><small>{{ selectedDay.pendingPlans.length }}</small>
          </div>
          <div
            v-for="action in selectedDay.pendingPlans"
            :key="action.id"
            class="plan-row"
            @click="executePlan(action)"
          >
            <div>
              <span class="plan-row__kind">{{ planLabel(action.planKind) }}</span>
              <strong>{{ action.customerName }}</strong>
              <span>{{ action.content }}</span>
            </div>
            <van-button v-if="canWrite" size="mini" plain @click.stop="openReschedule(action)">
              改期
            </van-button>
          </div>
        </section>

        <section v-if="selectedDay.businessRecords.length" class="day-card__section">
          <div class="day-card__section-title">
            <span>业务记录</span><small>{{ selectedDay.businessRecords.length }}</small>
          </div>
          <button
            v-for="record in selectedDay.businessRecords"
            :key="`${record.type}-${record.id}`"
            type="button"
            class="record-row"
            @click="openActualRecord(record)"
          >
            <div class="record-row__head">
              <span>{{ recordLabel(record.type) }}</span>
            </div>
            <strong>{{ record.customerName }}</strong>
            <span>{{ record.summary }}</span>
            <small>{{ record.sourcePlanId ? '执行计划形成' : '临时记录' }}</small>
          </button>
        </section>

        <section v-if="selectedDay.complaintRecords.length" class="day-card__section">
          <div class="day-card__section-title">
            <span>客诉</span><small>{{ selectedDay.complaintRecords.length }}</small>
          </div>
          <button
            v-for="record in selectedDay.complaintRecords"
            :key="`${record.type}-${record.id}`"
            type="button"
            class="record-row record-row--complaint"
            @click="openActualRecord(record)"
          >
            <div class="record-row__head">
              <span>{{ recordLabel(record.type) }}</span>
            </div>
            <strong>{{ record.customerName }}</strong>
            <span>{{ record.summary }}</span>
            <small>{{ record.sourcePlanId ? '执行计划形成' : '临时记录' }}</small>
          </button>
        </section>

        <details v-if="selectedDay.closedPlans.length" class="day-card__closed">
          <summary>已结束计划 {{ selectedDay.closedPlans.length }}</summary>
          <div
            v-for="action in selectedDay.closedPlans"
            :key="action.id"
            class="closed-row"
            :class="{ 'closed-row--clickable': action.status === 'completed' }"
            @click="openClosedPlan(action)"
          >
            <span>{{ planLabel(action.planKind) }}</span>
            <strong>{{ action.customerName }}</strong>
            <small>{{ action.status === 'completed' ? '已执行' : action.cancelReason }}</small>
          </div>
        </details>

        <div v-if="!selectedDay.hasContent" class="day-card__empty">当天还没有安排或记录</div>
        <div v-if="canWrite" class="day-card__add" @click="goQuickAdd(selectedDay.date)">
          ＋ 记录当日实际
        </div>
      </article>

      <section v-else-if="viewMode === 'week'" class="week-overview">
        <div class="week-overview__legend">
          <span></span><span></span><span>待办</span><span>已执行</span><span>临时</span
          ><span>客诉</span>
        </div>
        <button
          v-for="day in days"
          :key="day.date"
          type="button"
          class="week-overview__row"
          :class="{ 'is-today': day.isToday }"
          @click="selectDay(day.date)"
        >
          <strong>{{ day.weekday }}</strong>
          <small>{{ day.monthDay }}</small>
          <span>{{ day.pendingPlans.length }}</span>
          <span>{{ executedCount(day) }}</span>
          <span>{{ temporaryRecordCount(day) }}</span>
          <span>{{ day.complaintRecords.length }}</span>
        </button>
      </section>
    </template>

    <van-popup v-model:show="commandSheet.visible" position="bottom" round>
      <div class="command-sheet">
        <h3>计划改期</h3>
        <van-notice-bar
          v-if="selectedAction"
          wrapable
          :scrollable="false"
          :text="`原计划：${formatDateTime(selectedAction.plannedAt)} · ${selectedAction.content}`"
        />
        <van-field v-model="commandSheet.plannedAt" label="新日期" type="date" required />
        <van-field
          v-model="commandSheet.reason"
          label="改期原因"
          type="textarea"
          rows="2"
          maxlength="150"
          show-word-limit
          required
          placeholder="例如：客户临时调整时间"
        />
        <div v-if="commandSheet.history.length" class="command-sheet__history">
          <strong>历史改期</strong>
          <div
            v-for="item in commandSheet.history"
            :key="item.id"
            class="command-sheet__history-item"
          >
            <span
              >{{ formatDateTime(item.fromPlannedAt) }} →
              {{ formatDateTime(item.toPlannedAt) }}</span
            >
            <small>{{ item.reason }} · {{ item.changedByName }}</small>
          </div>
        </div>
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
  getSalesPlanReschedules,
  getWeekView,
  rescheduleSalesPlan,
  useAuthStore,
  useQuery,
  type SalesPlan,
  type SalesPlanKind,
  type SalesPlanReschedule,
} from '@crm/domain'
import {
  actualRecordRoute,
  buildMobileWeekDays,
  localDate,
  salesPlanExecutionRoute,
  type MobileActualRecord,
  type MobileWeekDay,
} from '../libs/sales-workbench'

const router = useRouter()
const auth = useAuthStore()
const canWrite = computed(() => auth.hasAbility('customer.write'))
const today = new Date()
const todayText = localDate(today)
const weekOffset = ref(0)
const viewMode = ref<'day' | 'week'>('day')
const selectedDate = ref(todayText)
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
const selectedDay = computed(() => days.value.find((day) => day.date === selectedDate.value))

watch(weekOffset, () => void reload())

const selectedAction = ref<SalesPlan>()
const commandSheet = reactive({
  visible: false,
  plannedAt: '',
  reason: '',
  history: [] as SalesPlanReschedule[],
  saving: false,
})

function shiftWeek(value: number, selectEdge?: 'start' | 'end') {
  weekOffset.value += value
  selectedDate.value =
    selectEdge === 'end'
      ? range.value.sunday
      : weekOffset.value === 0
        ? todayText
        : range.value.monday
}
function goToday() {
  weekOffset.value = 0
  selectedDate.value = todayText
  viewMode.value = 'day'
}
function selectDay(date: string) {
  selectedDate.value = date
  viewMode.value = 'day'
}
function moveSelectedDay(offset: -1 | 1) {
  const index = days.value.findIndex((day) => day.date === selectedDate.value)
  const target = days.value[index + offset]
  if (target) {
    selectedDate.value = target.date
    return
  }
  shiftWeek(offset, offset < 0 ? 'end' : 'start')
}
function executePlan(action: SalesPlan) {
  if (canWrite.value) void router.push(salesPlanExecutionRoute(action))
}
function openReschedule(action: SalesPlan) {
  selectedAction.value = action
  commandSheet.plannedAt = action.plannedAt
  commandSheet.reason = ''
  commandSheet.history = []
  commandSheet.visible = true
  void getSalesPlanReschedules(action.id)
    .then((history) => {
      if (selectedAction.value?.id === action.id) commandSheet.history = history
    })
    .catch((historyError) => {
      showToast(historyError instanceof Error ? historyError.message : '改期历史加载失败')
    })
}
async function submitReschedule() {
  const action = selectedAction.value
  if (!action || !commandSheet.plannedAt) return showToast('请选择新的计划日期')
  if (!commandSheet.reason.trim()) return showToast('请填写改期原因')
  commandSheet.saving = true
  try {
    await rescheduleSalesPlan(
      action.id,
      action.version,
      commandSheet.plannedAt,
      commandSheet.reason.trim(),
    )
    showToast('计划已改期并保留记录')
    commandSheet.visible = false
    await reload()
  } catch (commandError) {
    showToast(commandError instanceof Error ? commandError.message : '改期失败')
  } finally {
    commandSheet.saving = false
  }
}
function formatDateTime(value: string) {
  return value.length === 10 ? value : new Date(value).toLocaleString('zh-CN', { hour12: false })
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
function executedCount(day: MobileWeekDay): number {
  return day.closedPlans.filter((plan) => plan.status === 'completed').length
}
function temporaryRecordCount(day: MobileWeekDay): number {
  return day.businessRecords.filter((record) => !record.sourcePlanId).length
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
.view-switch {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  margin: var(--crm-spacing-sm);
  padding: 3px;
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-border);
}
.view-switch button {
  padding: 7px;
  border: 0;
  border-radius: calc(var(--crm-radius-md) - 2px);
  background: transparent;
  color: var(--crm-color-text-secondary);
}
.view-switch button.is-active {
  background: var(--crm-color-bg-card);
  color: var(--crm-color-primary);
  font-weight: 700;
}
.day-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  margin: 0 var(--crm-spacing-sm) var(--crm-spacing-sm);
  overflow: hidden;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.day-strip__item {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 7px 1px;
  border: 0;
  border-right: 1px solid var(--crm-color-border);
  background: transparent;
  color: var(--crm-color-text-secondary);
  text-align: center;
}
.day-strip__item:last-child {
  border-right: 0;
}
.day-strip__item strong {
  color: var(--crm-color-text-primary);
  font-size: 17px;
}
.day-strip__item small {
  overflow: hidden;
  font-size: 9px;
  white-space: nowrap;
}
.day-strip__item.is-today strong {
  color: var(--crm-color-primary);
}
.day-strip__item.is-selected {
  background: var(--crm-color-primary-light);
}
.day-card--selected,
.week-overview {
  margin: 0 var(--crm-spacing-sm) var(--crm-spacing-lg);
}
.day-card {
  overflow: hidden;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
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
.day-card__head > .van-icon {
  padding: var(--crm-spacing-xs);
  color: var(--crm-color-primary);
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
.week-overview {
  overflow: hidden;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.week-overview__legend,
.week-overview__row {
  display: grid;
  grid-template-columns: 34px 46px repeat(4, minmax(0, 1fr));
  align-items: center;
  gap: 2px;
  text-align: center;
}
.week-overview__legend {
  padding: var(--crm-spacing-xs) var(--crm-spacing-sm);
  background: var(--crm-color-bg-page);
  color: var(--crm-color-text-secondary);
  font-size: 10px;
}
.week-overview__row {
  width: 100%;
  padding: var(--crm-spacing-sm);
  border: 0;
  border-top: 1px solid var(--crm-color-border);
  background: transparent;
  color: inherit;
}
.week-overview__row.is-today {
  background: var(--crm-color-primary-light);
}
.week-overview__row small {
  color: var(--crm-color-text-secondary);
}
.week-overview__row span {
  font-variant-numeric: tabular-nums;
}
.command-sheet {
  padding: var(--crm-spacing-lg);
}
.command-sheet h3 {
  margin-top: 0;
  text-align: center;
}
.command-sheet__history {
  display: grid;
  gap: var(--crm-spacing-xs);
  margin-top: var(--crm-spacing-md);
  padding-top: var(--crm-spacing-md);
  border-top: 1px solid var(--crm-color-border);
  font-size: var(--crm-font-size-sm);
}
.command-sheet__history-item {
  display: grid;
  gap: 2px;
  padding: var(--crm-spacing-xs) 0;
}
.command-sheet__history-item small {
  color: var(--crm-color-text-secondary);
}
.command-sheet__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--crm-spacing-sm);
  margin-top: var(--crm-spacing-lg);
}
</style>
