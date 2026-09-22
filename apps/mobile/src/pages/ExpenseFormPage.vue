<template>
  <div class="expense-form">
    <van-nav-bar title="费用填报" left-arrow @click-left="returnBack" />

    <van-form @submit="saveAndSubmit">
      <van-cell-group inset title="当日费用">
        <van-field
          v-model="form.expenseDate"
          label="日期"
          readonly
          is-link
          :rules="[{ required: true, message: '请选择费用日期' }]"
          @click="showCalendar = true"
        />
        <van-field v-model.number="form.dining" label="餐叙" type="number" placeholder="元" />
        <van-field v-model.number="form.gifts" label="礼品" type="number" placeholder="元" />
        <van-field
          v-model.number="form.tobaccoAlcohol"
          label="烟酒"
          type="number"
          placeholder="元"
        />
        <van-field
          v-model.number="form.entertainment"
          label="娱乐招待"
          type="number"
          placeholder="元"
        />
        <van-field v-model.number="form.lodging" label="住宿" type="number" placeholder="元" />
        <van-field
          v-model="form.notes"
          label="备注"
          type="textarea"
          rows="2"
          maxlength="200"
          show-word-limit
          placeholder="选填"
        />
      </van-cell-group>
      <div class="expense-form__actions">
        <van-button block round native-type="button" :loading="saving" @click="saveDraft">
          保存草稿
        </van-button>
        <van-button block round type="primary" native-type="submit" :loading="saving">
          保存并提交
        </van-button>
      </div>
    </van-form>
    <van-calendar
      v-model:show="showCalendar"
      title="选择费用日期"
      :show-confirm="false"
      :default-date="new Date(`${form.expenseDate}T00:00:00`)"
      :min-date="calendarMinDate"
      :max-date="todayDate"
      @confirm="pickExpenseDate"
    />
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  listExpenses,
  isBusinessDate,
  localBusinessDate,
  submitExpense,
  upsertExpense,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const fromWork = route.query.source === 'work'
const today = localBusinessDate()
const todayDate = new Date(`${today}T00:00:00`)
const calendarMinDate = new Date(todayDate.getFullYear() - 2, 0, 1)
const requestedDate =
  isBusinessDate(route.query.date) && route.query.date <= today ? route.query.date : today
const form = reactive({
  expenseDate: requestedDate,
  dining: undefined as number | undefined,
  gifts: undefined as number | undefined,
  tobaccoAlcohol: undefined as number | undefined,
  entertainment: undefined as number | undefined,
  lodging: undefined as number | undefined,
  notes: '',
})
const saving = ref(false)
const showCalendar = ref(false)
let loadRevision = 0

watch(() => form.expenseDate, loadExisting, { immediate: true })

async function loadExisting() {
  const requestedExpenseDate = form.expenseDate
  const revision = ++loadRevision
  clearAmounts()
  try {
    const items = await listExpenses(requestedExpenseDate.slice(0, 7))
    if (revision !== loadRevision) return
    const current = items.find((item) => item.expenseDate === requestedExpenseDate)
    if (!current || current.status !== 'draft') return
    form.dining = numberOrUndefined(current.dining)
    form.gifts = numberOrUndefined(current.gifts)
    form.tobaccoAlcohol = numberOrUndefined(current.tobaccoAlcohol)
    form.entertainment = numberOrUndefined(current.entertainment)
    form.lodging = numberOrUndefined(current.lodging)
    form.notes = current.notes ?? ''
  } catch (error) {
    if (revision === loadRevision) {
      showToast(error instanceof Error ? error.message : '费用记录加载失败')
    }
  }
}

function clearAmounts() {
  form.dining = undefined
  form.gifts = undefined
  form.tobaccoAlcohol = undefined
  form.entertainment = undefined
  form.lodging = undefined
  form.notes = ''
}
function numberOrUndefined(value: string | null): number | undefined {
  return value === null ? undefined : Number(value)
}
function pickExpenseDate(value: Date | Date[]) {
  form.expenseDate = localBusinessDate(Array.isArray(value) ? value[0] : value)
  showCalendar.value = false
}
function hasAmount(): boolean {
  return [form.dining, form.gifts, form.tobaccoAlcohol, form.entertainment, form.lodging].some(
    (value) => Number(value) > 0,
  )
}
async function save(submitNow: boolean) {
  if (!hasAmount()) return showToast('请至少填写一项费用金额')
  if (form.expenseDate > today) return showToast('不能填写未来日期的费用')
  saving.value = true
  try {
    const currentItems = await listExpenses(form.expenseDate.slice(0, 7))
    const current = currentItems.find((item) => item.expenseDate === form.expenseDate)
    if (current && current.status !== 'draft') {
      return showToast('该日期费用已经提交或作废，不能继续修改')
    }
    const saved = await upsertExpense({
      expenseDate: form.expenseDate,
      dining: form.dining,
      gifts: form.gifts,
      tobaccoAlcohol: form.tobaccoAlcohol,
      entertainment: form.entertainment,
      lodging: form.lodging,
      notes: form.notes.trim() || undefined,
      version: current?.version,
    })
    if (submitNow) await submitExpense(saved.id, saved.version)
    showToast(submitNow ? '费用已保存并提交' : '费用草稿已保存')
    await router.replace(fromWork ? '/' : '/expenses')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '费用保存失败')
  } finally {
    saving.value = false
  }
}
function saveDraft() {
  void save(false)
}
function saveAndSubmit() {
  void save(true)
}
function returnBack() {
  void router.replace(fromWork ? '/' : '/expenses')
}
</script>

<style scoped>
.expense-form {
  min-height: 100vh;
  padding-bottom: var(--crm-spacing-xl);
  background: var(--crm-color-bg-page);
}
.expense-form__actions {
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: var(--crm-spacing-sm);
  padding: var(--crm-spacing-xl) var(--crm-spacing-md);
}
</style>
