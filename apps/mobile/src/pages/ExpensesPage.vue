<template>
  <div class="expenses">
    <van-nav-bar title="费用" right-text="填报" @click-right="router.push('/expenses/new')" />

    <section class="expenses__summary">
      <div>
        <span>{{ expenseMonthLabel(month) }}已提交</span>
        <strong>¥{{ money(submittedTotal) }}</strong>
      </div>
      <div>
        <span>待提交草稿</span>
        <strong>{{ draftCount }} 天</strong>
      </div>
    </section>

    <section class="expenses__calendar" aria-label="费用月历">
      <div class="expenses__month-nav">
        <button type="button" aria-label="上个月" @click="moveMonth(-1)">‹</button>
        <strong>{{ expenseMonthLabel(month) }}</strong>
        <button
          type="button"
          aria-label="下个月"
          :disabled="month >= currentMonth"
          @click="moveMonth(1)"
        >
          ›
        </button>
      </div>
      <div v-if="loadError" class="expenses__error">
        <span>{{ loadError }}</span>
        <van-button size="small" type="primary" @click="load">重新加载</van-button>
      </div>
      <template v-else>
        <p v-if="!loading && !items.length" class="expenses__month-empty">该月暂无费用记录</p>
        <div class="expenses__grid" role="grid" :aria-label="`${expenseMonthLabel(month)}费用日历`">
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
              <span>{{ Number(date.slice(-2)) }}</span>
              <i
                v-if="expenseOn(date)"
                class="expenses__dot"
                :class="`expenses__dot--${expenseOn(date)?.status}`"
              />
            </button>
          </div>
        </div>
        <div class="expenses__legend">
          <span><i class="expenses__dot expenses__dot--submitted" />已提交</span>
          <span><i class="expenses__dot expenses__dot--draft" />草稿</span>
          <span><i class="expenses__dot expenses__dot--voided" />已作废</span>
        </div>
      </template>
      <van-loading v-if="loading" class="expenses__loading" size="20" />
    </section>

    <section v-if="!loadError && !loading" class="expenses__detail" aria-label="所选日期费用明细">
      <div class="expenses__detail-head">
        <strong>{{ selectedDayLabel }}</strong>
        <van-tag v-if="selectedExpense" :type="statusType(selectedExpense.status)">
          {{ statusLabel(selectedExpense.status) }}
        </van-tag>
      </div>
      <template v-if="selectedExpense">
        <div class="expenses__amount">¥{{ money(totalOf(selectedExpense)) }}</div>
        <div class="expenses__parts">
          <span v-for="part in expenseParts(selectedExpense)" :key="part.label">
            {{ part.label }} ¥{{ money(part.value) }}
          </span>
        </div>
        <p v-if="selectedExpense.notes" class="expenses__notes">
          备注：{{ selectedExpense.notes }}
        </p>
        <div class="expenses__actions">
          <van-button
            v-if="selectedExpense.status === 'draft'"
            size="small"
            type="primary"
            plain
            @click="edit(selectedExpense)"
            >编辑草稿</van-button
          >
          <van-button
            v-if="selectedExpense.status === 'draft'"
            size="small"
            type="success"
            @click="submit(selectedExpense)"
            >提交</van-button
          >
          <van-button
            v-if="selectedExpense.status !== 'voided'"
            size="small"
            type="danger"
            plain
            @click="remove(selectedExpense)"
            >作废</van-button
          >
        </div>
      </template>
      <p v-else class="expenses__empty">该日暂无费用记录</p>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
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

const router = useRouter()
const weekdays = ['一', '二', '三', '四', '五', '六', '日']
const today = localBusinessDate()
const currentMonth = today.slice(0, 7)
const month = ref(currentMonth)
const selectedDay = ref(today)
const items = ref<Expense[]>([])
const loading = ref(false)
const loadError = ref('')
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
  loadError.value = ''
  try {
    const result = await listExpenses(month.value)
    if (revision === loadRevision) items.value = result
  } catch (cause) {
    if (revision === loadRevision) {
      items.value = []
      loadError.value = cause instanceof Error ? cause.message : '费用记录加载失败'
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
function totalOf(expense: Expense): number {
  return [
    expense.dining,
    expense.gifts,
    expense.tobaccoAlcohol,
    expense.entertainment,
    expense.lodging,
  ].reduce((sum, value) => sum + (Number(value) || 0), 0)
}
function money(value: number): string {
  return value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
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
function statusLabel(status: string): string {
  return status === 'submitted' ? '已提交' : status === 'voided' ? '已作废' : '草稿'
}
function statusType(status: string): 'success' | 'danger' | 'warning' {
  return status === 'submitted' ? 'success' : status === 'voided' ? 'danger' : 'warning'
}
function dayAriaLabel(date: string): string {
  const expense = expenseOn(date)
  return `${date}${expense ? `，${statusLabel(expense.status)}，${money(totalOf(expense))}元` : '，无费用记录'}`
}
function edit(expense: Expense) {
  void router.push({ path: '/expenses/new', query: { date: expense.expenseDate } })
}
async function submit(expense: Expense) {
  try {
    await submitExpense(expense.id, expense.version)
    showToast('费用已提交')
    await load()
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '提交失败')
  }
}
async function remove(expense: Expense) {
  try {
    await showConfirmDialog({
      title: '作废费用记录',
      message: `${expense.expenseDate} 的费用记录将保留痕迹，但不再计入统计。`,
      confirmButtonText: '确认作废',
    })
  } catch {
    return
  }
  try {
    await voidExpense(expense.id, expense.version)
    showToast('费用已作废')
    await load()
  } catch (cause) {
    showToast(cause instanceof Error ? cause.message : '作废失败')
  }
}
</script>

<style scoped>
.expenses {
  min-height: 100vh;
  padding-bottom: 88px;
  background: var(--crm-color-bg-page);
}
.expenses__summary {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  margin: var(--crm-spacing-md);
  overflow: hidden;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-border);
}
.expenses__summary > div {
  padding: var(--crm-spacing-md);
  background: var(--crm-color-bg-card);
}
.expenses__summary span,
.expenses__summary strong {
  display: block;
}
.expenses__summary span {
  color: var(--crm-color-text-secondary);
  font-size: 11px;
}
.expenses__summary strong {
  margin-top: 4px;
  font-size: 20px;
}
.expenses__calendar,
.expenses__detail {
  margin: var(--crm-spacing-md);
  padding: 14px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.expenses__month-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
}
.expenses__month-nav strong {
  font-size: 16px;
}
.expenses__month-nav button {
  width: 34px;
  height: 34px;
  border: 0;
  background: var(--crm-color-bg-page);
  border-radius: 8px;
  color: var(--crm-color-text-primary);
  font-size: 24px;
  line-height: 1;
}
.expenses__month-nav button:disabled {
  opacity: 0.35;
}
.expenses__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px 0;
}
.expenses__weekday {
  padding: 6px 0 9px;
  color: var(--crm-color-text-secondary);
  text-align: center;
  font-size: 12px;
}
.expenses__cell {
  min-width: 0;
}
.expenses__day {
  display: flex;
  width: 100%;
  height: 44px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--crm-color-text-primary);
  font-size: 14px;
}
.expenses__day--selected {
  background: var(--crm-color-primary-light);
  color: var(--crm-color-primary);
  font-weight: 700;
}
.expenses__day--today:not(.expenses__day--selected) {
  box-shadow: inset 0 0 0 1px var(--crm-color-primary);
}
.expenses__dot {
  display: inline-block;
  width: 5px;
  height: 5px;
  flex: none;
  border-radius: 50%;
  background: #aab3c3;
}
.expenses__dot--submitted {
  background: #348060;
}
.expenses__dot--draft {
  background: #d19831;
}
.expenses__dot--voided {
  background: #aab3c3;
}
.expenses__legend {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 12px;
  color: var(--crm-color-text-secondary);
  font-size: 11px;
}
.expenses__legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.expenses__detail-head,
.expenses__actions {
  display: flex;
  align-items: center;
  gap: 9px;
}
.expenses__detail-head strong {
  font-size: 16px;
}
.expenses__amount {
  margin-top: 12px;
  font-size: 22px;
  font-weight: 700;
}
.expenses__parts {
  display: flex;
  flex-wrap: wrap;
  gap: 7px 12px;
  margin-top: 8px;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
.expenses__notes,
.expenses__empty {
  color: var(--crm-color-text-secondary);
  font-size: 13px;
}
.expenses__actions {
  flex-wrap: wrap;
  margin-top: 16px;
}
.expenses__loading {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}
.expenses__error {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--crm-color-text-secondary);
  font-size: 13px;
}
.expenses__month-empty {
  margin: 0 0 10px;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
  text-align: center;
}
</style>
