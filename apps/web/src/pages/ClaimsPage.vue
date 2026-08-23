<template>
  <div class="claims">
    <header class="claims__header">
      <h1 class="claims__title">接管审批</h1>
      <el-button @click="router.push('/')">返回首页</el-button>
    </header>

    <el-card class="claims__card">
      <el-table v-loading="loading" :data="claims ?? []" border>
        <el-table-column prop="customerName" label="客户" min-width="160" />
        <el-table-column prop="applicantName" label="申请人" min-width="100" />
        <el-table-column prop="reason" label="理由" min-width="160" />
        <el-table-column prop="createdAt" label="申请时间" min-width="150">
          <template #default="{ row }">{{ formatTime((row as ClaimListItem).createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="success" @click="handleApprove(row as ClaimListItem)"
              >批准</el-button
            >
            <el-button size="small" type="danger" @click="handleReject(row as ClaimListItem)"
              >拒绝</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <p v-if="claims && claims.length === 0" class="claims__empty">暂无待审批申请</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  useQuery,
  listPendingClaims,
  approveClaim,
  rejectClaim,
  type ClaimListItem,
} from '@crm/domain'

const router = useRouter()
const { data: claims, loading, reload } = useQuery('claims:pending', listPendingClaims)

function formatTime(v: string): string {
  return v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '-'
}

async function handleApprove(claim: ClaimListItem) {
  try {
    await ElMessageBox.prompt(`批准 ${claim.customerName} 的接管申请？可填写意见`, '审批', {
      confirmButtonText: '批准',
      cancelButtonText: '取消',
      inputPlaceholder: '意见（可选）',
    })
  } catch {
    return
  }
  // ElMessageBox.prompt 返回 value；此处简化：无意见直接批准
  await act(() => approveClaim(claim.id), '已批准')
}

async function handleReject(claim: ClaimListItem) {
  try {
    const { value } = await ElMessageBox.prompt('填写拒绝意见（必填）', '拒绝', {
      confirmButtonText: '拒绝',
      cancelButtonText: '取消',
      inputValidator: (v: string) => (v?.trim() ? true : '拒绝必须填写意见'),
    })
    await act(() => rejectClaim(claim.id, value), '已拒绝')
  } catch {
    /* 取消或校验失败 */
  }
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
</script>

<style scoped>
.claims {
  padding: var(--crm-spacing-xl);
}
.claims__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-lg);
}
.claims__title {
  margin: 0;
  color: var(--crm-color-text-primary);
}
.claims__card {
  max-width: 860px;
}
.claims__empty {
  text-align: center;
  color: var(--crm-color-text-secondary);
  padding: var(--crm-spacing-xl);
}
</style>
