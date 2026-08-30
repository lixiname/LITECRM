<template>
  <div class="week-view">
    <header class="work-header">
      <div>
        <span>{{ todayLabel }}</span>
        <h1>今日工作</h1>
      </div>
      <div class="work-header__avatar" aria-hidden="true">{{ userInitial }}</div>
    </header>
    <div class="week-view__nav">
      <van-icon name="arrow-left" size="18" @click="shiftWeek(-1)" />
      <button type="button" class="week-view__range" @click="showWeekCalendar = true">
        {{ weekNavigationLabel }} <van-icon name="arrow-down" />
      </button>
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

      <div class="view-switch" role="tablist" aria-label="工作视图">
        <button
          type="button"
          :class="{ 'is-active': viewMode === 'day' }"
          @click="viewMode = 'day'"
        >
          每日
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

      <button
        v-if="canWrite && selectedDay && selectedDay.date <= todayText"
        type="button"
        class="work-quick"
        @click="goQuickAdd(selectedDay.date)"
      >
        <span>{{
          selectedDay.date === todayText ? '现场发生的事情最重要' : '补充该日实际业务事实'
        }}</span>
        <strong>
          {{ selectedDay.date === todayText ? '快速记录' : '补录实际' }}
          <b aria-hidden="true">＋</b>
        </strong>
      </button>

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
            :class="{ 'plan-row--overdue': isOverdue(action) }"
            @click="executePlan(action)"
          >
            <div>
              <span class="plan-row__kind">{{ planLabel(action.planKind) }}</span>
              <small v-if="isOverdue(action)">已逾期</small>
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

    <van-calendar
      v-model:show="showWeekCalendar"
      title="选择所在周"
      :show-confirm="false"
      :default-date="calendarDefaultDate"
      :min-date="calendarMinDate"
      :max-date="calendarMaxDate"
      @confirm="selectCalendarDate"
    >
      <template #footer>
        <div class="week-calendar__footer">
          <van-button block plain type="primary" @click="selectToday">今天</van-button>
        </div>
      </template>
    </van-calendar>

    <van-popup v-model:show="commandSheet.visible" position="bottom" round>
      <div class="command-sheet">
        <h3>计划改期</h3>
        <van-notice-bar
          v-if="selectedAction"
          wrapable
          :scrollable="false"
          :text="`原计划：${formatDateTime(selectedAction.plannedAt)} · ${selectedAction.content}`"
        />
        <van-field
          v-model="commandSheet.plannedAt"
          label="新日期"
          readonly
          is-link
          required
          @click="showRescheduleCalendar = true"
        />
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
          <strong>计划调整历史</strong>
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
            <small v-if="item.fromContent !== item.toContent">
              {{ item.fromContent || '未填写' }} → {{ item.toContent || '未填写' }}
            </small>
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

    <van-calendar
      v-model:show="showRescheduleCalendar"
      title="选择新的计划日期"
      :show-confirm="false"
      :default-date="rescheduleDefaultDate"
      :min-date="today"
      :max-date="rescheduleMaxDate"
      @confirm="selectRescheduleDate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  getSalesPlanReschedules,
  getWeekView,
  isBusinessDate,
  businessWeekRange,
  rescheduleSalesPlan,
  shiftBusinessDate,
  startOfBusinessWeek,
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
const route = useRoute()
const auth = useAuthStore()
const canWrite = computed(() => auth.hasAbility('customer.write'))
const today = new Date()
const todayText = localDate(today)
const todayLabel = today.toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long',
})
const userInitial = computed(() => auth.user?.displayName?.slice(0, 1) ?? '我')
const currentWeekStart = startOfBusinessWeek(todayText)
const routeWeek = isBusinessDate(route.query.week) ? route.query.week : currentWeekStart
const weekStart = ref(startOfBusinessWeek(routeWeek))
const viewMode = ref<'day' | 'week'>('day')
const selectedDate = ref(weekStart.value === currentWeekStart ? todayText : weekStart.value)
const range = computed(() => businessWeekRange(weekStart.value))
const weekRangeLabel = computed(() => {
  const start = new Date(`${range.value.monday}T00:00:00`)
  const end = new Date(`${range.value.sunday}T00:00:00`)
  return `${start.getMonth() + 1}/${start.getDate()} — ${end.getMonth() + 1}/${end.getDate()}`
})
const weekNavigationLabel = computed(() => {
  const previous = shiftBusinessDate(currentWeekStart, -7)
  const next = shiftBusinessDate(currentWeekStart, 7)
  const relation =
    weekStart.value === currentWeekStart
      ? '本周'
      : weekStart.value === previous
        ? '上周'
        : weekStart.value === next
          ? '下周'
          : ''
  return relation ? `${relation} · ${weekRangeLabel.value}` : weekRangeLabel.value
})
const showWeekCalendar = ref(false)
const calendarDefaultDate = computed(() => new Date(`${selectedDate.value}T00:00:00`))
const calendarMinDate = new Date(today.getFullYear() - 2, 0, 1)
const calendarMaxDate = new Date(today.getFullYear() + 2, 11, 31)
const showRescheduleCalendar = ref(false)
const rescheduleMaxDate = new Date(today.getFullYear() + 2, 11, 31)
const {
  data: view,
  loading,
  error,
  reload,
} = useQuery('mobile:week-view', () => getWeekView(range.value.monday, range.value.sunday))
const days = computed(() => buildMobileWeekDays(range.value.monday, todayText, view.value))
const selectedDay = computed(() => days.value.find((day) => day.date === selectedDate.value))

watch(weekStart, (value) => {
  void reload()
  if (route.query.week !== value) {
    void router.push({ query: { ...route.query, week: value } })
  }
})
watch(
  () => route.query.week,
  (value) => {
    if (!isBusinessDate(value)) return
    const normalized = startOfBusinessWeek(value)
    if (normalized === weekStart.value) return
    const selectedIndex = Math.max(
      0,
      Math.min(
        6,
        Math.round(
          (new Date(`${selectedDate.value}T00:00:00`).getTime() -
            new Date(`${weekStart.value}T00:00:00`).getTime()) /
            86_400_000,
        ),
      ),
    )
    weekStart.value = normalized
    selectedDate.value = shiftBusinessDate(normalized, selectedIndex)
  },
)

const selectedAction = ref<SalesPlan>()
const commandSheet = reactive({
  visible: false,
  plannedAt: '',
  reason: '',
  history: [] as SalesPlanReschedule[],
  saving: false,
})
const rescheduleDefaultDate = computed(() =>
  commandSheet.plannedAt ? new Date(`${commandSheet.plannedAt.slice(0, 10)}T00:00:00`) : today,
)

function shiftWeek(value: number, selectEdge?: 'start' | 'end') {
  const selectedIndex = Math.max(
    0,
    Math.min(
      6,
      Math.round(
        (new Date(`${selectedDate.value}T00:00:00`).getTime() -
          new Date(`${weekStart.value}T00:00:00`).getTime()) /
          86_400_000,
      ),
    ),
  )
  weekStart.value = shiftBusinessDate(weekStart.value, value * 7)
  selectedDate.value =
    selectEdge === 'end'
      ? range.value.sunday
      : selectEdge === 'start'
        ? range.value.monday
        : shiftBusinessDate(range.value.monday, selectedIndex)
}
function selectToday() {
  weekStart.value = currentWeekStart
  selectedDate.value = todayText
  viewMode.value = 'day'
  showWeekCalendar.value = false
}
function selectCalendarDate(value: Date | Date[]) {
  const selected = Array.isArray(value) ? value[0] : value
  selectedDate.value = localDate(selected)
  weekStart.value = startOfBusinessWeek(selectedDate.value)
  viewMode.value = 'day'
  showWeekCalendar.value = false
}
function selectRescheduleDate(value: Date | Date[]) {
  const selected = Array.isArray(value) ? value[0] : value
  commandSheet.plannedAt = localDate(selected)
  showRescheduleCalendar.value = false
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
function isOverdue(action: SalesPlan): boolean {
  return action.status === 'pending' && action.plannedAt.slice(0, 10) < todayText
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
  void router.push({ path: '/quick-add', query: { source: 'week', date } })
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
.week-view {
  min-height: 100vh;
  padding-bottom: var(--crm-spacing-md);
  background: var(--crm-color-bg-page);
}
.work-header {
  display: flex;
  min-height: 76px;
  align-items: center;
  justify-content: space-between;
  padding: 15px var(--crm-spacing-lg) 12px;
  background: var(--crm-color-bg-card);
}
.work-header span {
  color: var(--crm-color-text-tertiary);
  font-size: 10px;
}
.work-header h1 {
  margin: 2px 0 0;
  font-size: 22px;
  line-height: 28px;
  letter-spacing: -0.035em;
}
.work-header__avatar {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 50%;
  background: var(--crm-color-primary-light);
  color: var(--crm-color-primary-active);
  font-size: 12px;
  font-weight: 750;
}
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
  margin: 0 var(--crm-spacing-md) var(--crm-spacing-sm);
  padding: 8px 10px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
  box-shadow: var(--crm-shadow-card);
}
.day-card__add {
  color: var(--crm-color-primary);
  font-weight: 600;
}
.week-view__range {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 4px 10px;
  border: 0;
  color: var(--crm-color-text-primary);
  background: transparent;
  font-weight: 600;
}
.week-calendar__footer {
  padding: var(--crm-spacing-sm) var(--crm-spacing-md) var(--crm-spacing-md);
}
.week-view__loading {
  display: block;
  margin: var(--crm-spacing-xl) auto;
}
.overdue-panel {
  margin: var(--crm-spacing-sm) var(--crm-spacing-md);
  padding: var(--crm-spacing-md);
  border: 1px solid #ecccca;
  border-radius: var(--crm-radius-lg);
  background: var(--crm-color-danger-light);
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
  margin: var(--crm-spacing-sm) var(--crm-spacing-md);
  padding: 3px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: #e9edea;
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
  color: var(--crm-color-primary-active);
  font-weight: 700;
  box-shadow: 0 2px 8px rgb(42 60 52 / 6%);
}
.day-strip {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 3px;
  margin: 0 var(--crm-spacing-md) var(--crm-spacing-sm);
  padding: 6px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-lg);
  background: var(--crm-color-bg-card);
  box-shadow: var(--crm-shadow-card);
}
.day-strip__item {
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 6px 1px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--crm-color-text-secondary);
  text-align: center;
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
  background: var(--crm-color-primary);
  color: #fff;
}
.day-strip__item.is-selected strong,
.day-strip__item.is-selected small {
  color: inherit;
}
.work-quick {
  display: grid;
  width: calc(100% - 24px);
  gap: 4px;
  margin: 0 var(--crm-spacing-md) var(--crm-spacing-sm);
  padding: 13px 14px;
  border: 0;
  border-radius: var(--crm-radius-lg);
  background: linear-gradient(135deg, var(--crm-color-primary), #4e8875);
  color: #fff;
  text-align: left;
  box-shadow: 0 8px 18px rgb(57 115 97 / 16%);
}
.work-quick span {
  opacity: 0.76;
  font-size: 10px;
}
.work-quick strong {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 14px;
}
.work-quick b {
  font-size: 18px;
  font-weight: 400;
}
.day-card--selected,
.week-overview {
  margin: 0 var(--crm-spacing-md) var(--crm-spacing-lg);
}
.day-card {
  overflow: hidden;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-lg);
  background: var(--crm-color-bg-card);
  box-shadow: var(--crm-shadow-card);
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
  background: var(--crm-color-bg-subtle);
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
  margin-top: var(--crm-spacing-sm);
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
  background: var(--crm-color-primary-light);
  color: var(--crm-color-primary-active);
  font-size: 10px;
  font-weight: 680;
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
  border: 1px solid var(--crm-color-divider);
  border-left: 3px solid var(--crm-color-success);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-soft);
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
  color: var(--crm-color-primary-active);
  text-align: center;
}
.week-overview {
  overflow: hidden;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-lg);
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
  background: var(--crm-color-bg-soft);
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
