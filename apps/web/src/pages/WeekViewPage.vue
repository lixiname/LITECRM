<template>
  <div class="week-view">
    <AppPageHeader title="行动周视图" :description="weekLabel">
      <template #actions>
        <el-button-group>
          <el-button @click="shiftWeek(-1)">上一周</el-button>
          <el-button @click="goToday">本周</el-button>
          <el-button @click="shiftWeek(1)">下一周</el-button>
        </el-button-group>
      </template>
    </AppPageHeader>

    <AppQueryState :error="error" @retry="reload" />

    <el-alert
      v-if="!error && view?.overdue.length"
      class="week-view__overdue"
      type="warning"
      :closable="false"
      :title="`还有 ${view.overdue.length} 项更早行动未完成`"
    >
      <div v-for="action in view.overdue" :key="action.id" class="overdue-row">
        <span
          >{{ formatDateTime(action.plannedAt) }} · {{ sourceLabel(action.sourceType) }} ·
          {{ action.content }}</span
        >
        <FollowUpActionMenu :action="action" @command="handleActionCommand" />
      </div>
    </el-alert>

    <el-card v-if="!error" v-loading="loading" class="week-view__card">
      <div class="week-view__grid">
        <div
          v-for="day in days"
          :key="day.date"
          class="week-view__col"
          :class="{ 'week-view__col--today': day.isToday }"
        >
          <div class="week-view__col-head">
            <span>{{ day.weekday }}</span>
            <span :class="{ 'week-view__date--today': day.isToday }">{{ day.monthDay }}</span>
          </div>

          <div class="week-view__body">
            <div v-for="action in day.actions" :key="action.id" class="week-view__item">
              <div class="week-view__item-head">
                <span>{{ sourceLabel(action.sourceType) }}</span>
                <small>{{ timeOnly(action.plannedAt) }}</small>
              </div>
              <div :title="action.content">{{ action.content }}</div>
              <FollowUpActionMenu :action="action" @command="handleActionCommand" />
            </div>
            <div class="week-view__add" @click="onBlankClick(day)">＋ 加行动</div>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="showDialog" :title="`加行动（${dialogDate}）`" width="420px">
      <el-form label-width="80px">
        <el-form-item label="行动" required>
          <el-input v-model="actionContent" placeholder="如：拜访 XX 工厂" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitAction">添加</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="actionDialog.visible"
      :title="actionDialog.mode === 'reschedule' ? '改期行动' : '取消行动'"
      width="420px"
    >
      <el-form label-width="80px">
        <el-form-item v-if="actionDialog.mode === 'reschedule'" label="新时间" required>
          <el-input v-model="actionDialog.plannedAt" type="datetime-local" />
        </el-form-item>
        <el-form-item v-else label="取消原因" required>
          <el-input
            v-model="actionDialog.reason"
            type="textarea"
            :rows="3"
            placeholder="说明为什么不再执行这项行动"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="actionDialog.visible = false">返回</el-button>
        <el-button
          :type="actionDialog.mode === 'cancel' ? 'danger' : 'primary'"
          :loading="actionDialog.saving"
          @click="submitActionCommand"
        >
          {{ actionDialog.mode === 'cancel' ? '确认取消' : '确认改期' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import FollowUpActionMenu from '../components/actions/FollowUpActionMenu.vue'
import {
  cancelFollowUpAction,
  completeFollowUpAction,
  createPlanItemByDate,
  getWeekView,
  rescheduleFollowUpAction,
  useQuery,
  type FollowUpAction,
  type FollowUpActionSourceType,
} from '@crm/domain'

type ActionCommand = 'open' | 'complete' | 'reschedule' | 'cancel'

const router = useRouter()

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
  const start = new Date(`${range.value.monday}T00:00:00`)
  return `${start.getMonth() + 1}月${start.getDate()}日开始的一周`
})

const {
  data: view,
  loading,
  error,
  reload,
} = useQuery('web-week-view', () => getWeekView(range.value.monday, range.value.sunday))
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
  for (let index = 0; index < 7; index++) {
    const dateValue = new Date(`${range.value.monday}T00:00:00`)
    dateValue.setDate(dateValue.getDate() + index)
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
    ElMessage.success('行动已完成')
    await reload()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  }
}

const selectedAction = ref<FollowUpAction>()
const actionDialog = reactive({
  visible: false,
  mode: 'reschedule' as 'reschedule' | 'cancel',
  plannedAt: '',
  reason: '',
  saving: false,
})

function handleActionCommand(command: ActionCommand, action: FollowUpAction) {
  if (command === 'open') {
    const target = actionRoute(action)
    if (target) void router.push(target)
    else ElMessage.info('这是一项独立行动，没有关联业务详情')
    return
  }
  if (command === 'complete') {
    void markDone(action)
    return
  }
  selectedAction.value = action
  actionDialog.mode = command
  actionDialog.plannedAt = localInput(action.plannedAt)
  actionDialog.reason = ''
  actionDialog.visible = true
}

async function submitActionCommand() {
  const action = selectedAction.value
  if (!action) return
  if (actionDialog.mode === 'reschedule' && !actionDialog.plannedAt)
    return ElMessage.warning('请选择新的计划时间')
  if (actionDialog.mode === 'cancel' && !actionDialog.reason.trim())
    return ElMessage.warning('请填写取消原因')
  actionDialog.saving = true
  try {
    if (actionDialog.mode === 'reschedule') {
      await rescheduleFollowUpAction(
        action.id,
        action.version,
        new Date(actionDialog.plannedAt).toISOString(),
      )
      ElMessage.success('行动已改期')
    } else {
      await cancelFollowUpAction(action.id, action.version, actionDialog.reason.trim())
      ElMessage.success('行动已取消')
    }
    actionDialog.visible = false
    await reload()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    actionDialog.saving = false
  }
}

function actionRoute(action: FollowUpAction): string | undefined {
  if (action.opportunityId) return `/opportunities/${action.opportunityId}`
  if (action.complaintId) return `/complaints/${action.complaintId}`
  if (action.customerId) return `/customers/${action.customerId}`
  return undefined
}

function localInput(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const showDialog = ref(false)
const dialogDate = ref('')
const actionContent = ref('')
const saving = ref(false)

function onBlankClick(day: DayVM) {
  dialogDate.value = day.date
  actionContent.value = ''
  showDialog.value = true
}

async function submitAction() {
  if (!actionContent.value.trim()) return ElMessage.warning('行动内容必填')
  saving.value = true
  try {
    await createPlanItemByDate({
      plannedDate: dialogDate.value,
      action: actionContent.value.trim(),
    })
    ElMessage.success('行动已添加')
    showDialog.value = false
    await reload()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '添加失败')
  } finally {
    saving.value = false
  }
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
function fmt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function timeOnly(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.week-view__overdue {
  margin-bottom: var(--crm-spacing-md);
}
.overdue-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.week-view__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--crm-spacing-sm);
  min-height: 420px;
}
.week-view__col {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
}
.week-view__col--today {
  border-color: var(--crm-color-primary);
}
.week-view__col-head {
  display: flex;
  justify-content: space-between;
  padding: var(--crm-spacing-sm);
  border-bottom: 1px solid var(--crm-color-border);
  font-weight: 600;
}
.week-view__date--today {
  color: var(--crm-color-primary);
}
.week-view__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--crm-spacing-xs);
  padding: var(--crm-spacing-sm);
  overflow-y: auto;
}
.week-view__item {
  padding: 6px;
  border-radius: 4px;
  background: var(--crm-color-primary-light);
  font-size: var(--crm-font-size-sm);
  word-break: break-word;
}
.week-view__item-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  color: var(--crm-color-text-secondary);
}
.week-view__add {
  margin-top: auto;
  padding: var(--crm-spacing-sm);
  border-top: 1px dashed var(--crm-color-border);
  text-align: center;
  color: var(--crm-color-text-secondary);
  cursor: pointer;
}
</style>
