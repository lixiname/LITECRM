<template>
  <div class="expenses">
    <AppPageHeader title="我的费用" description="按月历查看每日费用；新增录入由移动端完成" />
    <el-card v-loading="loading" class="expenses__card">
      <div class="expenses__toolbar">
        <div class="expenses__month-nav">
          <el-button aria-label="上个月" @click="moveMonth(-1)">‹</el-button>
          <strong>{{ expenseMonthLabel(month) }}</strong>
          <el-button aria-label="下个月" :disabled="month >= currentMonth" @click="moveMonth(1)"
            >›</el-button
          >
        </div>
        <div class="expenses__summary">
          <span
            >已提交 <strong>¥{{ money(submittedTotal) }}</strong></span
          >
          <span
            >待提交草稿 <strong>{{ draftCount }} 天</strong></span
          >
        </div>
      </div>

      <AppQueryState :error="error" @retry="load" />
      <template v-if="!error">
        <div
          class="expenses__calendar"
          role="grid"
          :aria-label="`${expenseMonthLabel(month)}费用日历`"
        >
          <div v-for="weekday in weekdays" :key="weekday" class="expenses__weekday">
            {{ weekday }}
          </div>
          <div
            v-for="(date, index) in calendarDays"
            :key="date ?? `blank-${index}`"
            class="expenses__cell"
          >
            <button
              v-if="date"
              type="button"
              class="expenses__day"
              :class="{
                'expenses__day--selected': date === selectedDay,
                'expenses__day--today': date === today,
              }"
              :aria-label="dayAriaLabel(date)"
              :aria-pressed="date === selectedDay"
              @click="selectedDay = date"
            >
              <span class="expenses__day-number">{{ Number(date.slice(-2)) }}</span>
              <template v-if="expenseOn(date)">
                <span v-if="expenseOn(date)?.status !== 'voided'" class="expenses__day-amount">
                  ¥{{ money(totalOf(expenseOn(date)!)) }}
                </span>
                <span
                  class="expenses__day-status"
                  :class="`expenses__day-status--${expenseOn(date)?.status}`"
                >
                  {{ statusLabel(expenseOn(date)!.status) }}
                </span>
              </template>
            </button>
          </div>
        </div>

        <section class="expenses__detail" aria-label="所选日期费用明细">
          <div class="expenses__detail-head">
            <h3>{{ selectedDayLabel }}</h3>
            <el-tag v-if="selectedExpense" :type="statusTag(selectedExpense.status)">
              {{ statusLabel(selectedExpense.status) }}
            </el-tag>
          </div>
          <template v-if="selectedExpense">
            <div class="expenses__detail-total">¥{{ money(totalOf(selectedExpense)) }}</div>
            <div class="expenses__breakdown">
              <span v-for="part in expenseParts(selectedExpense)" :key="part.label">
                {{ part.label }} ¥{{ money(part.value) }}
              </span>
            </div>
            <p v-if="selectedExpense.notes" class="expenses__notes">
              备注：{{ selectedExpense.notes }}
            </p>
            <div class="expenses__actions">
              <el-button
                v-if="selectedExpense.status === 'draft'"
                type="primary"
                @click="submit(selectedExpense)"
                >提交</el-button
              >
              <el-button
                v-if="selectedExpense.status !== 'voided'"
                type="danger"
                plain
                @click="remove(selectedExpense)"
                >作废</el-button
              >
            </div>
          </template>
          <p v-else class="expenses__empty">该日暂无费用记录</p>
        </section>
      </template>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  expenseMonthCells,
  expenseMonthLabel,
  listExpenses,
  localBusinessDate,
  shiftExpenseMonth,
  submitExpense,
  voidExpense,
  type Expense,
} from '@crm/domain'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'

const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const today = localBusinessDate()
const currentMonth = today.slice(0, 7)
const month = ref(currentMonth)
const selectedDay = ref(today)
const items = ref<Expense[]>([])
const loading = ref(false)
const error = ref<string | null>(null)
let loadRevision = 0

const calendarDays = computed(() => expenseMonthCells(month.value))
const byDate = computed(() => new Map(items.value.map((expense) => [expense.expenseDate, expense])))
const selectedExpense = computed(() => byDate.value.get(selectedDay.value))
const selectedDayLabel = computed(
  () => `${Number(selectedDay.value.slice(5, 7))}月${Number(selectedDay.value.slice(8))}日`,
)
const submittedTotal = computed(() =>
  items.value
    .filter((item) => item.status === 'submitted')
    .reduce((sum, item) => sum + totalOf(item), 0),
)
const draftCount = computed(() => items.value.filter((item) => item.status === 'draft').length)

watch(month, load, { immediate: true })

async function load() {
  const revision = ++loadRevision
  loading.value = true
  error.value = null
  try {
    const result = await listExpenses(month.value)
    if (revision === loadRevision) items.value = result
  } catch (cause) {
    if (revision === loadRevision) {
      items.value = []
      error.value = cause instanceof Error ? cause.message : '费用记录加载失败'
    }
  } finally {
    if (revision === loadRevision) loading.value = false
  }
}
function moveMonth(offset: number) {
  const next = shiftExpenseMonth(month.value, offset)
  if (next > currentMonth) return
  month.value = next
  selectedDay.value = next === currentMonth ? today : `${next}-01`
  items.value = []
}
function expenseOn(date: string) {
  return byDate.value.get(date)
}
function money(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
function totalOf(expense: Expense): number {
  return [
    expense.dining,
    expense.gifts,
    expense.tobaccoAlcohol,
    expense.entertainment,
    expense.lodging,
  ].reduce((sum, value) => sum + (Number(value) || 0), 0)
}
function expenseParts(expense: Expense) {
  return [
    { label: '餐叙', value: Number(expense.dining) || 0 },
    { label: '礼品', value: Number(expense.gifts) || 0 },
    { label: '烟酒', value: Number(expense.tobaccoAlcohol) || 0 },
    { label: '娱乐招待', value: Number(expense.entertainment) || 0 },
    { label: '住宿', value: Number(expense.lodging) || 0 },
  ].filter((part) => part.value > 0)
}
function statusTag(status: string): 'success' | 'danger' | 'info' {
  return status === 'submitted' ? 'success' : status === 'voided' ? 'info' : 'danger'
}
function statusLabel(status: string): string {
  return status === 'submitted' ? '已提交' : status === 'voided' ? '已作废' : '草稿'
}
function dayAriaLabel(date: string): string {
  const expense = expenseOn(date)
  return `${date}${expense ? `，${statusLabel(expense.status)}，${money(totalOf(expense))}元` : '，无费用记录'}`
}
async function act(fn: () => Promise<unknown>, message: string) {
  try {
    await fn()
    ElMessage.success(message)
    await load()
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '操作失败')
  }
}
function submit(expense: Expense) {
  void act(() => submitExpense(expense.id, expense.version), '已提交')
}
async function remove(expense: Expense) {
  try {
    await ElMessageBox.confirm('作废后该记录不再计入有效费用统计，是否继续？', '确认作废', {
      confirmButtonText: '确认作废',
      cancelButtonText: '返回',
      type: 'warning',
    })
  } catch {
    return
  }
  await act(() => voidExpense(expense.id, expense.version), '已作废')
}
</script>

<style scoped>
.expenses {
  padding: var(--crm-spacing-lg);
}
.expenses__card {
  width: 100%;
}
.expenses__toolbar,
.expenses__month-nav,
.expenses__summary,
.expenses__detail-head,
.expenses__actions {
  display: flex;
  align-items: center;
}
.expenses__toolbar {
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.expenses__month-nav {
  gap: 16px;
  font-size: 18px;
}
.expenses__month-nav strong {
  min-width: 108px;
  text-align: center;
}
.expenses__summary {
  gap: 24px;
  color: var(--crm-color-text-secondary);
  font-size: 13px;
}
.expenses__summary strong {
  margin-left: 5px;
  color: var(--crm-color-text-primary);
  font-size: 17px;
}
.expenses__calendar {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border-top: 1px solid var(--crm-color-border);
  border-left: 1px solid var(--crm-color-border);
}
.expenses__weekday {
  padding: 10px;
  text-align: center;
  background: var(--crm-color-bg-page);
  color: var(--crm-color-text-secondary);
  font-size: 13px;
}
.expenses__cell {
  min-height: 94px;
  border-right: 1px solid var(--crm-color-border);
  border-bottom: 1px solid var(--crm-color-border);
}
.expenses__day {
  width: 100%;
  height: 100%;
  min-height: 94px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  border: 0;
  background: transparent;
  color: var(--crm-color-text-primary);
  text-align: left;
  cursor: pointer;
}
.expenses__day:hover {
  background: var(--crm-color-bg-page);
}
.expenses__day--selected {
  background: var(--crm-color-primary-light);
  box-shadow: inset 0 0 0 2px var(--crm-color-primary);
}
.expenses__day--today .expenses__day-number {
  color: var(--crm-color-primary);
  font-weight: 700;
}
.expenses__day-amount {
  font-size: 14px;
  font-weight: 600;
}
.expenses__day-status {
  font-size: 12px;
  color: var(--crm-color-text-secondary);
}
.expenses__day-status--submitted {
  color: #348060;
}
.expenses__day-status--draft {
  color: #ae751f;
}
.expenses__detail {
  padding: 20px 4px 4px;
}
.expenses__detail-head {
  gap: 12px;
}
.expenses__detail-head h3 {
  margin: 0;
  font-size: 17px;
}
.expenses__detail-total {
  margin-top: 14px;
  font-size: 24px;
  font-weight: 700;
}
.expenses__breakdown {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin-top: 8px;
  color: var(--crm-color-text-secondary);
}
.expenses__notes,
.expenses__empty {
  color: var(--crm-color-text-secondary);
}
.expenses__actions {
  gap: 8px;
  margin-top: 16px;
}
@media (max-width: 900px) {
  .expenses__summary {
    width: 100%;
  }
  .expenses__cell,
  .expenses__day {
    min-height: 74px;
  }
}
</style>
