<template>
  <div class="week-view">
    <van-nav-bar :title="weekLabel" />

    <!-- 周选择器 -->
    <div class="week-view__nav">
      <van-icon name="arrow-left" size="18" @click="shiftWeek(-1)" />
      <span class="week-view__thisweek" @click="goToday">本周</span>
      <van-icon name="arrow" size="18" @click="shiftWeek(1)" />
    </div>

    <van-loading v-if="loading" class="week-view__loading" size="24" />

    <!-- 7 张日 card（§2.2 单列日 card 流 + 类型分区） -->
    <div v-else class="week-view__days">
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
          <div v-if="typeItems(day, 'plan').length" class="day-card__row">
            <span class="day-card__tag day-card__tag--plan">计划</span>
            <span class="day-card__text">
              {{
                typeItems(day, 'plan')
                  .map((i) => i.summary)
                  .join('；')
              }}
            </span>
          </div>
          <div v-if="typeItems(day, 'visit').length" class="day-card__row">
            <span class="day-card__tag day-card__tag--visit">拜访</span>
            <span class="day-card__text">
              {{
                typeItems(day, 'visit')
                  .map((i) => i.summary)
                  .join('；')
              }}
            </span>
          </div>
          <div
            v-if="typeItems(day, 'opportunity').length"
            class="day-card__row"
            :class="{ 'day-card__row--overdue': anyOverdue(day, 'opportunity') }"
          >
            <span class="day-card__tag day-card__tag--opp">商机</span>
            <span class="day-card__text">
              {{
                typeItems(day, 'opportunity')
                  .map((i) => `${i.summary}${i.overdue ? '⚠' : ''}`)
                  .join('；')
              }}
            </span>
          </div>
          <div
            v-if="typeItems(day, 'complaint').length"
            class="day-card__row"
            :class="{ 'day-card__row--overdue': anyOverdue(day, 'complaint') }"
          >
            <span class="day-card__tag day-card__tag--complaint">客诉</span>
            <span class="day-card__text">
              {{
                typeItems(day, 'complaint')
                  .map((i) => `${i.summary}${i.overdue ? '⚠' : ''}`)
                  .join('；')
              }}
            </span>
          </div>
          <div v-if="day.items.length === 0" class="day-card__empty" @click="goQuickAdd(day)">
            + 记一笔
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuery, getWeekView, type WeekViewItemType, type WeekViewItem } from '@crm/domain'

const router = useRouter()

const today = new Date()
const todayStr = fmt(today)
const weekOffset = ref(0)

// 周范围：本周一 ± offset*7 天
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
  return `${d.getMonth() + 1}月${d.getDate()}日 周`
})

const {
  data: blocks,
  loading,
  reload,
} = useQuery('week-view', () => getWeekView(range.value.monday, range.value.sunday))
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
function anyOverdue(day: DayVM, type: WeekViewItemType): boolean {
  return day.items.some((i) => i.type === type && i.overdue)
}

// 空 card 记一笔：进 QuickAdd（类型面板 + 客户选择，预填日期）
function goQuickAdd(day: DayVM) {
  void router.push({ path: '/quick-add', query: { date: day.date } })
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
  color: var(--crm-color-text-primary);
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
.day-card__row {
  display: flex;
  align-items: baseline;
  gap: var(--crm-spacing-sm);
  font-size: var(--crm-font-size-sm);
}
.day-card__row--overdue {
  color: var(--crm-color-danger);
}
.day-card__tag {
  flex-shrink: 0;
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px;
  color: #fff;
}
.day-card__tag--plan {
  background: var(--crm-color-primary);
}
.day-card__tag--visit {
  background: var(--crm-color-success);
}
.day-card__tag--opp {
  background: var(--crm-color-warning);
}
.day-card__tag--complaint {
  background: var(--crm-color-danger);
}
.day-card__text {
  color: var(--crm-color-text-primary);
  word-break: break-all;
}
.day-card__empty {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
  padding: var(--crm-spacing-xs) 0;
}
</style>
