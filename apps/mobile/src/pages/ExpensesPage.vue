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
          label="招待"
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

    <van-cell-group inset title="本月记录">
      <van-cell
        v-for="e in items"
        :key="e.id"
        :title="e.expenseDate"
        :label="`¥${totalOf(e)} · ${statusLabel(e.status)}`"
      >
        <template #value>
          <van-button v-if="e.status === 'draft'" size="mini" type="success" @click="submit(e.id)"
            >提交</van-button
          >
          <van-button
            v-if="e.status !== 'voided'"
            size="mini"
            type="danger"
            plain
            @click="remove(e.id)"
            >作废</van-button
          >
        </template>
      </van-cell>
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { upsertExpense, listExpenses, submitExpense, voidExpense, type Expense } from '@crm/domain'

const router = useRouter()
const form = reactive({
  expenseDate: new Date().toISOString().slice(0, 10),
  dining: undefined as number | undefined,
  gifts: undefined as number | undefined,
  tobaccoAlcohol: undefined as number | undefined,
  entertainment: undefined as number | undefined,
  lodging: undefined as number | undefined,
  notes: '',
})
const items = ref<Expense[]>([])
const saving = ref(false)

async function load() {
  items.value = await listExpenses().catch(() => [])
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
    })
    showToast('已保存')
    await load()
  } catch (e) {
    showToast(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function submit(id: string) {
  await submitExpense(id).catch((e) => showToast(e.message))
  await load()
}
async function remove(id: string) {
  await voidExpense(id).catch((e) => showToast(e.message))
  await load()
}
</script>

<style scoped>
.exp__submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
