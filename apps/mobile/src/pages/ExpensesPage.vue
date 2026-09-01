<template>
  <div class="exp">
    <van-nav-bar title="费用 · 快速记一笔" left-arrow @click-left="router.back()" />

    <van-form @submit="handleSave">
      <van-cell-group inset>
        <van-field
          v-model="form.expenseDate"
          label="日期"
          type="date"
          :rules="[{ required: true }]"
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
        <van-field v-model="form.notes" label="备注" placeholder="选填" />
      </van-cell-group>
      <div class="exp__submit">
        <van-button round block type="primary" native-type="submit" :loading="saving"
          >保存</van-button
        >
      </div>
    </van-form>

    <van-loading v-if="loading" class="exp__loading" />
    <van-empty v-else-if="loadError" :description="loadError">
      <van-button size="small" type="primary" @click="load">重新加载</van-button>
    </van-empty>
    <van-cell-group v-else inset :title="`${currentMonthLabel}记录`">
      <van-cell
        v-for="e in items"
        :key="e.id"
        :title="e.expenseDate"
        :label="`¥${totalOf(e)} · ${statusLabel(e.status)}`"
      >
        <template #value>
          <van-button v-if="e.status === 'draft'" size="mini" type="success" @click="submit(e)"
            >提交</van-button
          >
          <van-button
            v-if="e.status !== 'voided'"
            size="mini"
            type="danger"
            plain
            @click="remove(e)"
            >作废</van-button
          >
        </template>
      </van-cell>
      <van-empty v-if="!items.length" description="本月暂无费用记录" :image-size="56" />
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  localBusinessDate,
  upsertExpense,
  listExpenses,
  submitExpense,
  voidExpense,
  type Expense,
} from '@crm/domain'

const router = useRouter()
const form = reactive({
  expenseDate: localBusinessDate(),
  dining: undefined as number | undefined,
  gifts: undefined as number | undefined,
  tobaccoAlcohol: undefined as number | undefined,
  entertainment: undefined as number | undefined,
  lodging: undefined as number | undefined,
  notes: '',
})
const items = ref<Expense[]>([])
const saving = ref(false)
const loading = ref(false)
const loadError = ref('')
const currentMonth = localBusinessDate().slice(0, 7)
const currentMonthLabel = `${Number(currentMonth.slice(5))} 月`

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

function totalOf(e: Expense): number {
  return [e.dining, e.gifts, e.tobaccoAlcohol, e.entertainment, e.lodging].reduce(
    (s, v) => s + (Number(v) || 0),
    0,
  )
}
function statusLabel(s: string): string {
  return s === 'submitted' ? '已提交' : s === 'voided' ? '已作废' : '草稿'
}

async function handleSave() {
  saving.value = true
  try {
    await upsertExpense({
      expenseDate: form.expenseDate,
      dining: form.dining,
      gifts: form.gifts,
      tobaccoAlcohol: form.tobaccoAlcohol,
      entertainment: form.entertainment,
      lodging: form.lodging,
      notes: form.notes || undefined,
      version: items.value.find((item) => item.expenseDate === form.expenseDate)?.version,
    })
    showToast('已保存')
    await load()
  } catch (e) {
    showToast(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
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
    await voidExpense(expense.id, expense.version)
    showToast('费用已作废')
    await load()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '作废失败')
  }
}
</script>

<style scoped>
.exp__submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
.exp__loading {
  display: block;
  margin: var(--crm-spacing-xl) auto;
}
</style>
