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
        <div class="overdue-panel__title">更早未完成 · {{ view.overdue.length }}</div>
        <div v-for="action in view.overdue" :key="action.id" class="action-row action-row--overdue">
          <div>
            <span class="action-row__source">{{ planLabel(action.planKind) }}</span>
            <strong>{{ action.customerName }}</strong>
            <span>{{ action.content }}</span>
            <small>{{ formatTime(action.plannedAt) }}</small>
          </div>
          <van-button size="mini" plain type="primary" @click="openActionSheet(action)">
            处理
          </van-button>
        </div>
      </section>

      <div class="week-view__days">
        <div
          v-for="day in days"
          :key="day.date"
          class="day-card"
          :class="{ 'day-card--today': day.isToday }"
        >
          <div class="day-card__head">
            <span class="day-card__weekday">{{ day.weekday }}</span>
            <span class="day-card__date" :class="{ 'day-card__date--today': day.isToday }">
              {{ day.monthDay }}
            </span>
          </div>

          <div class="day-card__body">
            <div class="day-card__section">计划</div>
            <div
              v-for="action in day.plans"
              :key="action.id"
              class="action-row"
              :class="{
                'action-row--completed': action.status === 'completed',
                'action-row--cancelled': action.status === 'cancelled',
              }"
            >
              <div>
                <span class="action-row__source">{{ planLabel(action.planKind) }}</span>
                <strong>{{ action.customerName }}</strong>
                <span>{{ action.content }}</span>
                <small>{{ timeOnly(action.plannedAt) }}</small>
              </div>
              <van-button
                v-if="action.status === 'pending'"
                size="mini"
                plain
                type="primary"
                @click="openActionSheet(action)"
              >
                处理
              </van-button>
            </div>
            <div v-if="day.plans.length === 0" class="day-card__empty">暂无计划</div>
            <div class="day-card__section">业务记录</div>
            <div v-for="record in day.businessRecords" :key="record.id" class="record-row">
              <strong>{{ record.customerName }}</strong>
              <span>{{ recordLabel(record.type) }} · {{ record.summary }}</span>
              <small>{{ timeOnly(record.occurredAt) }}</small>
            </div>
            <div v-if="day.businessRecords.length === 0" class="day-card__empty">暂无业务记录</div>
            <div class="day-card__section">客诉</div>
            <div
              v-for="record in day.complaintRecords"
              :key="record.id"
              class="record-row record-row--complaint"
            >
              <strong>{{ record.customerName }}</strong>
              <span
                >{{ record.type === 'complaint_registered' ? '客诉登记' : '客诉跟进' }} ·
                {{ record.summary }}</span
              >
              <small>{{ timeOnly(record.occurredAt) }}</small>
            </div>
            <div v-if="day.complaintRecords.length === 0" class="day-card__empty">暂无客诉</div>
            <div class="day-card__add">
              <span @click="goQuickAdd(day, 'plan')">+ 安排计划</span>
              <span @click="goQuickAdd(day, 'record')">+ 记录实际</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <van-action-sheet
      v-model:show="showActionSheet"
      :actions="actionOptions"
      cancel-text="返回"
      close-on-click-action
      @select="selectActionCommand"
    />

    <van-popup v-model:show="commandSheet.visible" position="bottom" round>
      <div class="command-sheet">
        <div class="command-sheet__title">
          {{ commandSheet.mode === 'reschedule' ? '计划改期' : '替换计划' }}
        </div>
        <van-field v-model="commandSheet.plannedAt" label="新时间" type="datetime-local" required />
        <template v-if="commandSheet.mode === 'replace'">
          <van-field v-model="commandSheet.content" label="新内容" required />
          <van-field
            v-model="commandSheet.reason"
            label="替换原因"
            type="textarea"
            rows="3"
            autosize
            required
          />
        </template>
        <div class="command-sheet__actions">
          <van-button block @click="commandSheet.visible = false">返回</van-button>
          <van-button
            block
            type="primary"
            :loading="commandSheet.saving"
            @click="submitActionCommand"
          >
            {{ commandSheet.mode === 'replace' ? '确认替换' : '确认改期' }}
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
  replaceSalesPlan,
  rescheduleSalesPlan,
  useQuery,
  type SalesPlan,
  type SalesPlanKind,
  type WeekBusinessRecord,
  type WeekComplaintRecord,
} from '@crm/domain'

const router = useRouter()
type ActionCommand = 'execute' | 'reschedule' | 'replace'

const actionOptions: { name: string; value: ActionCommand; color?: string }[] = [
  { name: '填写执行结果', value: 'execute' },
  { name: '改期', value: 'reschedule' },
  { name: '替换计划', value: 'replace' },
]
const today = new Date()
const todayStr = fmt(today)
const weekOffset = ref(0)

const range = computed(() => {
  const dow = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow + weekOffset.value * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday: fmt(monday), sunday: fmt(sunday) }
})
const weekLabel = computed(() => {
  const d = new Date(`${range.value.monday}T00:00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日 周`
})

const {
  data: view,
  loading,
  error,
  reload,
} = useQuery('week-view', () => getWeekView(range.value.monday, range.value.sunday))
watch(weekOffset, () => void reload())

interface DayVM {
  date: string
  weekday: string
  monthDay: string
  isToday: boolean
  plans: SalesPlan[]
  businessRecords: WeekBusinessRecord[]
  complaintRecords: WeekComplaintRecord[]
}

const days = computed<DayVM[]>(() => {
  const actionMap = new Map<string, SalesPlan[]>()
  const businessMap = new Map<string, WeekBusinessRecord[]>()
  const complaintMap = new Map<string, WeekComplaintRecord[]>()
  for (const action of view.value?.plans ?? []) {
    const date = fmt(new Date(action.plannedAt))
    actionMap.set(date, [...(actionMap.get(date) ?? []), action])
  }
  for (const record of view.value?.businessRecords ?? []) {
    const date = fmt(new Date(record.occurredAt))
    businessMap.set(date, [...(businessMap.get(date) ?? []), record])
  }
  for (const record of view.value?.complaintRecords ?? []) {
    const date = fmt(new Date(record.occurredAt))
    complaintMap.set(date, [...(complaintMap.get(date) ?? []), record])
  }
  const result: DayVM[] = []
  for (let i = 0; i < 7; i++) {
    const dateValue = new Date(`${range.value.monday}T00:00:00`)
    dateValue.setDate(dateValue.getDate() + i)
    const date = fmt(dateValue)
    result.push({
      date,
      weekday: '周' + '一二三四五六日'[(dateValue.getDay() + 6) % 7],
      monthDay: `${dateValue.getMonth() + 1}/${dateValue.getDate()}`,
      isToday: date === todayStr,
      plans: actionMap.get(date) ?? [],
      businessRecords: businessMap.get(date) ?? [],
      complaintRecords: complaintMap.get(date) ?? [],
    })
  }
  return result
})

function shiftWeek(offset: number) {
  weekOffset.value += offset
}

function goToday() {
  weekOffset.value = 0
}

const showActionSheet = ref(false)
const selectedAction = ref<SalesPlan>()
const commandSheet = reactive({
  visible: false,
  mode: 'reschedule' as 'reschedule' | 'replace',
  plannedAt: '',
  content: '',
  reason: '',
  saving: false,
})

function openActionSheet(action: SalesPlan) {
  selectedAction.value = action
  showActionSheet.value = true
}

function selectActionCommand(option: { value: ActionCommand }) {
  const action = selectedAction.value
  if (!action) return
  if (option.value === 'execute') {
    void router.push(executionRoute(action))
    return
  }
  commandSheet.mode = option.value
  commandSheet.plannedAt = localInput(action.plannedAt)
  commandSheet.content = action.content
  commandSheet.reason = ''
  commandSheet.visible = true
}

async function submitActionCommand() {
  const action = selectedAction.value
  if (!action) return
  if (commandSheet.mode === 'reschedule' && !commandSheet.plannedAt)
    return showToast('请选择新的计划时间')
  if (
    commandSheet.mode === 'replace' &&
    (!commandSheet.content.trim() || !commandSheet.reason.trim())
  )
    return showToast('请填写新内容和替换原因')
  commandSheet.saving = true
  try {
    if (commandSheet.mode === 'reschedule') {
      await rescheduleSalesPlan(
        action.id,
        action.version,
        new Date(commandSheet.plannedAt).toISOString(),
      )
      showToast('计划已改期')
    } else {
      await replaceSalesPlan(
        action.id,
        action.version,
        new Date(commandSheet.plannedAt).toISOString(),
        commandSheet.content.trim(),
        commandSheet.reason.trim(),
      )
      showToast('计划已替换')
    }
    commandSheet.visible = false
    await reload()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '操作失败')
  } finally {
    commandSheet.saving = false
  }
}

function executionRoute(plan: SalesPlan) {
  if (plan.planKind === 'opportunity_follow_up')
    return `/opportunities/${plan.opportunityId}/follow-up?planId=${plan.id}`
  if (plan.planKind === 'complaint_follow_up')
    return `/complaints/${plan.complaintId}/follow-up?planId=${plan.id}`
  return `/customers/${plan.customerId}/visit/new?planId=${plan.id}`
}

function localInput(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function planLabel(kind: SalesPlanKind): string {
  return {
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机跟进',
    complaint_follow_up: '客诉处理',
  }[kind]
}

function goQuickAdd(day: DayVM, mode: 'plan' | 'record') {
  void router.push({ path: '/quick-add', query: { date: day.date, mode } })
}

function recordLabel(type: WeekBusinessRecord['type']) {
  return {
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机跟进',
    opportunity_quote: '报价记录',
  }[type]
}

function fmt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
.week-view__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--crm-spacing-sm) var(--crm-spacing-lg);
  background: var(--crm-color-bg-card);
  border-bottom: 1px solid var(--crm-color-border);
}
.week-view__thisweek {
  color: var(--crm-color-primary);
  font-weight: 600;
}
.week-view__loading {
  margin: var(--crm-spacing-xl) auto;
}
.overdue-panel {
  margin: var(--crm-spacing-sm);
  padding: var(--crm-spacing-sm) var(--crm-spacing-md);
  border: 1px solid var(--crm-color-danger);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.overdue-panel__title {
  margin-bottom: var(--crm-spacing-xs);
  color: var(--crm-color-danger);
  font-weight: 600;
}
.week-view__days {
  padding: var(--crm-spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--crm-spacing-sm);
}
.day-card {
  background: var(--crm-color-bg-card);
  border-radius: var(--crm-radius-md);
  border: 1px solid var(--crm-color-border);
  padding: var(--crm-spacing-sm) var(--crm-spacing-md);
}
.day-card--today {
  border-color: var(--crm-color-primary);
}
.day-card__head {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-sm);
}
.day-card__weekday {
  font-weight: 600;
}
.day-card__date {
  color: var(--crm-color-text-secondary);
}
.day-card__date--today {
  color: var(--crm-color-primary);
  font-weight: 600;
}
.day-card__body {
  display: flex;
  flex-direction: column;
  gap: var(--crm-spacing-xs);
}
.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-sm);
  padding: 4px 0;
  font-size: var(--crm-font-size-sm);
}
.action-row--overdue {
  color: var(--crm-color-danger);
}
.action-row--completed {
  filter: grayscale(1);
  opacity: 0.58;
}
.action-row--cancelled {
  opacity: 0.42;
  text-decoration: line-through;
}
.day-card__section {
  margin-top: 6px;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}
.record-row {
  display: flex;
  flex-direction: column;
  padding: 6px 8px;
  border-left: 3px solid var(--crm-color-success);
  background: var(--crm-color-bg-page);
  font-size: var(--crm-font-size-sm);
}
.record-row--complaint {
  border-left-color: var(--crm-color-danger);
}
.record-row small {
  color: var(--crm-color-text-secondary);
}
.day-card__add {
  display: flex;
  justify-content: space-around;
  padding-top: var(--crm-spacing-sm);
  color: var(--crm-color-primary);
  font-size: var(--crm-font-size-sm);
}
.action-row__source {
  display: inline-block;
  margin-right: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
  background: var(--crm-color-primary);
  font-size: 12px;
}
.action-row small {
  display: block;
  margin-top: 2px;
  color: var(--crm-color-text-secondary);
}
.day-card__empty {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
  padding: var(--crm-spacing-xs) 0;
}
.command-sheet {
  padding: var(--crm-spacing-lg);
}
.command-sheet__title {
  margin-bottom: var(--crm-spacing-md);
  text-align: center;
  font-weight: 600;
}
.command-sheet__actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--crm-spacing-sm);
  margin-top: var(--crm-spacing-lg);
}
</style>
