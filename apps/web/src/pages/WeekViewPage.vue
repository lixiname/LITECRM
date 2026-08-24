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

    <el-card v-loading="loading" class="week-view__card">
      <!-- 横向 7 列周网格（§2.3：一屏一周，hover/点击） -->
      <div class="week-view__grid">
        <div
          v-for="day in days"
          :key="day.date"
          class="week-view__col"
          :class="{ 'week-view__col--today': day.isToday }"
        >
          <div class="week-view__col-head">
            <span class="week-view__weekday">{{ day.weekday }}</span>
            <span class="week-view__date" :class="{ 'week-view__date--today': day.isToday }">
              {{ day.monthDay }}
            </span>
          </div>

          <div class="week-view__body">
            <div
              v-for="item in typeItems(day, 'plan')"
              :key="item.id"
              class="week-view__item week-view__item--plan"
              :title="item.summary"
            >
              📋 {{ item.summary }}
            </div>
            <div
              v-for="item in typeItems(day, 'visit')"
              :key="item.id"
              class="week-view__item week-view__item--visit"
              :title="item.summary"
            >
              ✅ {{ item.summary }}
            </div>
            <div
              v-for="item in typeItems(day, 'opportunity')"
              :key="item.id"
              class="week-view__item week-view__item--opp"
              :class="{ 'week-view__item--overdue': item.overdue }"
              :title="item.summary"
            >
              💼 {{ item.summary }}{{ item.overdue ? ' ⚠' : '' }}
            </div>
            <div
              v-for="item in typeItems(day, 'complaint')"
              :key="item.id"
              class="week-view__item week-view__item--complaint"
              :class="{ 'week-view__item--overdue': item.overdue }"
              :title="item.summary"
            >
              ⚠️ {{ item.summary }}{{ item.overdue ? ' ⚠' : '' }}
            </div>

            <div class="week-view__add" @click="onBlankClick(day)">＋ 加计划</div>
          </div>
        </div>
      </div>
    </el-card>

    <!-- 点空白加计划（§2.4 日历式） -->
    <el-dialog v-model="showDialog" :title="`加计划（${dialogDate}）`" width="420px">
      <el-form label-width="80px">
        <el-form-item label="行动计划" required>
          <el-input v-model="planAction" placeholder="如：拜访XX工厂" maxlength="100" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitPlan">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  useQuery,
  getWeekView,
  createPlanItemByDate,
  type WeekViewItem,
  type WeekViewItemType,
} from '@crm/domain'

const today = new Date()
const todayStr = fmt(today)
const weekOffset = ref(0)

const range = computed(() => {
  const dow = (today.getDay() + 6) % 7 // 0=周一
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow + weekOffset.value * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday: fmt(monday), sunday: fmt(sunday) }
})
const weekLabel = computed(() => {
  const d = new Date(`${range.value.monday}T00:00:00`)
  return `${d.getMonth() + 1}月${d.getDate()}日 ~ 周`
})

const {
  data: blocks,
  loading,
  reload,
} = useQuery('web-week-view', () => getWeekView(range.value.monday, range.value.sunday))
watch(weekOffset, () => void reload())

function shiftWeek(n: number) {
  weekOffset.value += n
}
function goToday() {
  weekOffset.value = 0
}

interface DayVM {
  date: string
  weekday: string
  monthDay: string
  isToday: boolean
  items: WeekViewItem[]
}
const days = computed<DayVM[]>(() => {
  const map = new Map((blocks.value ?? []).map((d) => [d.date, d.items]))
  const arr: DayVM[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(`${range.value.monday}T00:00:00`)
    d.setDate(d.getDate() + i)
    const date = fmt(d)
    arr.push({
      date,
      weekday: '周' + '一二三四五六日'[(d.getDay() + 6) % 7],
      monthDay: `${d.getMonth() + 1}/${d.getDate()}`,
      isToday: date === todayStr,
      items: map.get(date) ?? [],
    })
  }
  return arr
})

function typeItems(day: DayVM, type: WeekViewItemType): WeekViewItem[] {
  return day.items.filter((i) => i.type === type)
}

// 点空白加计划（日历式）
const showDialog = ref(false)
const dialogDate = ref('')
const planAction = ref('')
const saving = ref(false)

function onBlankClick(day: DayVM) {
  dialogDate.value = day.date
  planAction.value = ''
  showDialog.value = true
}

async function submitPlan() {
  if (!planAction.value.trim()) {
    ElMessage.warning('行动计划必填')
    return
  }
  saving.value = true
  try {
    await createPlanItemByDate({ plannedDate: dialogDate.value, action: planAction.value.trim() })
    ElMessage.success('计划已添加')
    showDialog.value = false
    void reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '添加失败')
  } finally {
    saving.value = false
  }
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  color: var(--crm-color-text-primary);
}
.week-view__grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: var(--crm-spacing-sm);
  min-height: 420px;
}
.week-view__col {
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
  display: flex;
  flex-direction: column;
}
.week-view__col--today {
  border-color: var(--crm-color-primary);
}
.week-view__col-head {
  display: flex;
  justify-content: space-between;
  padding: var(--crm-spacing-sm) var(--crm-spacing-sm);
  border-bottom: 1px solid var(--crm-color-border);
}
.week-view__weekday {
  font-weight: 600;
  color: var(--crm-color-text-primary);
}
.week-view__date {
  color: var(--crm-color-text-secondary);
}
.week-view__date--today {
  color: var(--crm-color-primary);
  font-weight: 600;
}
.week-view__body {
  flex: 1;
  padding: var(--crm-spacing-sm);
  display: flex;
  flex-direction: column;
  gap: var(--crm-spacing-xs);
  overflow-y: auto;
}
.week-view__item {
  font-size: var(--crm-font-size-sm);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--crm-color-text-primary);
  cursor: default;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.week-view__item--plan {
  background: var(--crm-color-primary-light);
}
.week-view__item--visit {
  background: #e8f5e9;
}
.week-view__item--opp {
  background: #fff8e1;
}
.week-view__item--complaint {
  background: #fce4ec;
}
.week-view__item--overdue {
  color: var(--crm-color-danger);
  font-weight: 600;
}
.week-view__add {
  margin-top: auto;
  padding: var(--crm-spacing-sm);
  text-align: center;
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
  cursor: pointer;
  border-top: 1px dashed var(--crm-color-border);
}
.week-view__add:hover {
  color: var(--crm-color-primary);
}
</style>
