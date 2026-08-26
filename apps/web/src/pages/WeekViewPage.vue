<template>
  <div class="week-view">
    <header class="week-view__header">
      <el-button-group>
        <el-button @click="shiftWeek(-1)">上一周</el-button>
        <el-button @click="goToday">本周</el-button>
        <el-button @click="shiftWeek(1)">下一周</el-button>
      </el-button-group>
      <span class="week-view__label">{{ weekLabel }}</span>
    </header>

    <el-alert
      v-if="view?.overdue.length"
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
        <el-button link type="primary" @click="markDone(action)">完成</el-button>
      </div>
    </el-alert>

    <el-card v-loading="loading" class="week-view__card">
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
              <el-button link type="primary" @click="markDone(action)">完成</el-button>
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  completeFollowUpAction,
  createPlanItemByDate,
  getWeekView,
  useQuery,
  type FollowUpAction,
  type FollowUpActionSourceType,
} from '@crm/domain'

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
.week-view__header {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-lg);
  margin-bottom: var(--crm-spacing-lg);
}
.week-view__label {
  font-size: var(--crm-font-size-lg);
  font-weight: 600;
}
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
