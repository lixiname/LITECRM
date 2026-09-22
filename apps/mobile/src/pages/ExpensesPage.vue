<template>
  <div class="expenses">
    <van-nav-bar title="费用" right-text="填报" @click-right="router.push('/expenses/new')" />

    <section class="expenses__summary">
      <div>
        <span>{{ currentMonthLabel }}已提交</span>
        <strong>¥{{ money(submittedTotal) }}</strong>
      </div>
      <div>
        <span>待提交草稿</span>
        <strong>{{ draftCount }} 天</strong>
      </div>
    </section>

    <van-loading v-if="loading" class="expenses__loading" />
    <van-empty v-else-if="loadError" :description="loadError">
      <van-button size="small" type="primary" @click="load">重新加载</van-button>
    </van-empty>
    <van-cell-group v-else inset :title="`${currentMonthLabel}费用记录`">
      <van-cell
        v-for="expense in items"
        :key="expense.id"
        :title="expense.expenseDate"
        :label="expenseSummary(expense)"
        :is-link="expense.status === 'draft'"
        @click="expense.status === 'draft' && edit(expense)"
      >
        <template #value>
          <van-tag :type="statusType(expense.status)">{{ statusLabel(expense.status) }}</van-tag>
        </template>
        <template #right-icon>
          <div v-if="expense.status === 'draft'" class="expenses__actions">
            <van-button size="mini" type="success" @click.stop="submit(expense)">提交</van-button>
            <van-button size="mini" type="danger" plain @click.stop="remove(expense)">
              作废
            </van-button>
          </div>
          <van-button
            v-else-if="expense.status === 'submitted'"
            size="mini"
            type="danger"
            plain
            @click.stop="remove(expense)"
          >
            作废
          </van-button>
        </template>
      </van-cell>
      <van-empty v-if="!items.length" description="本月暂无费用记录" :image-size="56" />
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import {
  listExpenses,
  localBusinessDate,
  submitExpense,
  voidExpense,
  type Expense,
} from '@crm/domain'

const router = useRouter()
const items = ref<Expense[]>([])
const loading = ref(false)
const loadError = ref('')
const currentMonth = localBusinessDate().slice(0, 7)
const currentMonthLabel = `${Number(currentMonth.slice(5))} 月`
const submittedTotal = computed(() =>
  items.value
    .filter((item) => item.status === 'submitted')
    .reduce((sum, item) => sum + totalOf(item), 0),
)
const draftCount = computed(() => items.value.filter((item) => item.status === 'draft').length)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    items.value = await listExpenses(currentMonth)
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '费用记录加载失败'
  } finally {
    loading.value = false
  }
}
onMounted(load)

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
function expenseSummary(expense: Expense): string {
  const categories = [
    Number(expense.dining) ? `餐叙 ${money(Number(expense.dining))}` : '',
    Number(expense.gifts) ? `礼品 ${money(Number(expense.gifts))}` : '',
    Number(expense.tobaccoAlcohol) ? `烟酒 ${money(Number(expense.tobaccoAlcohol))}` : '',
    Number(expense.entertainment) ? `娱乐招待 ${money(Number(expense.entertainment))}` : '',
    Number(expense.lodging) ? `住宿 ${money(Number(expense.lodging))}` : '',
  ].filter(Boolean)
  return `¥${money(totalOf(expense))}${categories.length ? ` · ${categories.join('、')}` : ''}`
}
function statusLabel(status: string): string {
  return status === 'submitted' ? '已提交' : status === 'voided' ? '已作废' : '草稿'
}
function statusType(status: string): 'success' | 'danger' | 'warning' {
  return status === 'submitted' ? 'success' : status === 'voided' ? 'danger' : 'warning'
}
function edit(expense: Expense) {
  void router.push({ path: '/expenses/new', query: { date: expense.expenseDate } })
}
async function submit(expense: Expense) {
  try {
    await submitExpense(expense.id, expense.version)
    showToast('费用已提交')
    await load()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '提交失败')
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
  } catch (error) {
    showToast(error instanceof Error ? error.message : '作废失败')
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
.expenses__loading {
  display: block;
  margin: var(--crm-spacing-xl) auto;
}
.expenses__actions {
  display: flex;
  gap: var(--crm-spacing-xs);
  margin-left: var(--crm-spacing-sm);
}
</style>
