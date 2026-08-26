<template>
  <div class="expenses">
    <AppPageHeader title="费用管理" description="按自然月查看费用记录；快速录入由移动端完成" />
    <el-card class="expenses__card">
      <el-table v-if="!error && items?.length" v-loading="loading" :data="items" border>
        <el-table-column prop="expenseDate" label="日期" width="110" />
        <el-table-column label="金额" width="140">
          <template #default="{ row }">¥{{ totalOf(row as Expense).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column prop="notes" label="备注" min-width="140" />
        <el-table-column label="状态" width="90">
          <template #default="{ row }">
            <el-tag :type="statusTag((row as Expense).status)">{{
              statusLabel((row as Expense).status)
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button
              v-if="(row as Expense).status === 'draft'"
              size="small"
              type="success"
              @click="submit((row as Expense).id)"
              >提交</el-button
            >
            <el-button
              v-if="(row as Expense).status !== 'voided'"
              size="small"
              type="danger"
              plain
              @click="remove((row as Expense).id)"
              >作废</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <AppQueryState
        :error="error"
        :empty="!loading && !items?.length"
        empty-text="本月暂无费用记录"
        @retry="reload"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ElMessage, ElMessageBox } from 'element-plus'
import { useQuery, listExpenses, submitExpense, voidExpense, type Expense } from '@crm/domain'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'

const { data: items, loading, error, reload } = useQuery('expenses:list', () => listExpenses())

function totalOf(e: Expense): number {
  return [e.dining, e.gifts, e.tobaccoAlcohol, e.entertainment, e.lodging].reduce(
    (s, v) => s + (Number(v) || 0),
    0,
  )
}
function statusTag(s: string): 'success' | 'danger' | 'info' {
  return s === 'submitted' ? 'success' : s === 'voided' ? 'info' : 'danger'
}
function statusLabel(s: string): string {
  return s === 'submitted' ? '已提交' : s === 'voided' ? '已作废' : '草稿'
}

async function act(fn: () => Promise<unknown>, msg: string) {
  try {
    await fn()
    ElMessage.success(msg)
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}
function submit(id: string) {
  void act(() => submitExpense(id), '已提交')
}
async function remove(id: string) {
  try {
    await ElMessageBox.confirm('作废后该记录不再计入有效费用统计，是否继续？', '确认作废', {
      confirmButtonText: '确认作废',
      cancelButtonText: '返回',
      type: 'warning',
    })
  } catch {
    return
  }
  await act(() => voidExpense(id), '已作废')
}
</script>

<style scoped>
.expenses {
  padding: var(--crm-spacing-lg);
}
.expenses__card {
  width: 100%;
  max-width: none;
}
</style>
