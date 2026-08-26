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
            <span class="action-row__source">{{ sourceLabel(action.sourceType) }}</span>
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
            <div v-for="action in day.actions" :key="action.id" class="action-row">
              <div>
                <span class="action-row__source">{{ sourceLabel(action.sourceType) }}</span>
                <span>{{ action.content }}</span>
                <small>{{ timeOnly(action.plannedAt) }}</small>
              </div>
              <van-button size="mini" plain type="primary" @click="openActionSheet(action)">
                处理
              </van-button>
            </div>
            <div v-if="day.actions.length === 0" class="day-card__empty" @click="goQuickAdd(day)">
              + 记一笔
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
          {{ commandSheet.mode === 'reschedule' ? '改期行动' : '取消行动' }}
        </div>
        <van-field
          v-if="commandSheet.mode === 'reschedule'"
          v-model="commandSheet.plannedAt"
          label="新时间"
          type="datetime-local"
          required
        />
        <van-field
          v-else
          v-model="commandSheet.reason"
          label="取消原因"
          type="textarea"
          rows="3"
          autosize
          required
          placeholder="说明为什么不再执行"
        />
        <div class="command-sheet__actions">
          <van-button block @click="commandSheet.visible = false">返回</van-button>
          <van-button
            block
            :type="commandSheet.mode === 'cancel' ? 'danger' : 'primary'"
            :loading="commandSheet.saving"
            @click="submitActionCommand"
          >
            {{ commandSheet.mode === 'cancel' ? '确认取消' : '确认改期' }}
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
  cancelFollowUpAction,
  completeFollowUpAction,
  getWeekView,
  rescheduleFollowUpAction,
  useQuery,
  type FollowUpAction,
  type FollowUpActionSourceType,
} from '@crm/domain'

const router = useRouter()
type ActionCommand = 'open' | 'complete' | 'reschedule' | 'cancel'

const actionOptions: { name: string; value: ActionCommand; color?: string }[] = [
  { name: '查看关联客户', value: 'open' },
  { name: '标记完成', value: 'complete' },
  { name: '改期', value: 'reschedule' },
  { name: '取消行动', value: 'cancel', color: '#ee0a24' },
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
  actions: FollowUpAction[]
}

const days = computed<DayVM[]>(() => {
  const actionMap = new Map<string, FollowUpAction[]>()
  for (const action of view.value?.actions ?? []) {
    const date = fmt(new Date(action.plannedAt))
    actionMap.set(date, [...(actionMap.get(date) ?? []), action])
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
      actions: actionMap.get(date) ?? [],
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

async function markDone(action: FollowUpAction) {
  try {
    await completeFollowUpAction(action.id, action.version)
    showToast('行动已完成')
    await reload()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '操作失败')
  }
}

const showActionSheet = ref(false)
const selectedAction = ref<FollowUpAction>()
const commandSheet = reactive({
  visible: false,
  mode: 'reschedule' as 'reschedule' | 'cancel',
  plannedAt: '',
  reason: '',
  saving: false,
})

function openActionSheet(action: FollowUpAction) {
  selectedAction.value = action
  showActionSheet.value = true
}

function selectActionCommand(option: { value: ActionCommand }) {
  const action = selectedAction.value
  if (!action) return
  if (option.value === 'open') {
    const target = actionRoute(action)
    if (target) void router.push(target)
    else showToast('这是一项独立行动，没有关联业务详情')
    return
  }
  if (option.value === 'complete') {
    void markDone(action)
    return
  }
  commandSheet.mode = option.value
  commandSheet.plannedAt = localInput(action.plannedAt)
  commandSheet.reason = ''
  commandSheet.visible = true
}

async function submitActionCommand() {
  const action = selectedAction.value
  if (!action) return
  if (commandSheet.mode === 'reschedule' && !commandSheet.plannedAt)
    return showToast('请选择新的计划时间')
  if (commandSheet.mode === 'cancel' && !commandSheet.reason.trim())
    return showToast('请填写取消原因')
  commandSheet.saving = true
  try {
    if (commandSheet.mode === 'reschedule') {
      await rescheduleFollowUpAction(
        action.id,
        action.version,
        new Date(commandSheet.plannedAt).toISOString(),
      )
      showToast('行动已改期')
    } else {
      await cancelFollowUpAction(action.id, action.version, commandSheet.reason.trim())
      showToast('行动已取消')
    }
    commandSheet.visible = false
    await reload()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '操作失败')
  } finally {
    commandSheet.saving = false
  }
}

function actionRoute(action: FollowUpAction): string | undefined {
  if (action.customerId) return `/customers/${action.customerId}`
  return undefined
}

function localInput(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function sourceLabel(source: FollowUpActionSourceType): string {
  return {
    manual: '手工',
    visit: '拜访',
    opportunity: '商机',
    opportunity_follow_up: '商机',
    opportunity_quote: '报价',
    complaint: '客诉',
    complaint_follow_up: '客诉',
  }[source]
}

function goQuickAdd(day: DayVM) {
  void router.push({ path: '/quick-add', query: { date: day.date } })
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
