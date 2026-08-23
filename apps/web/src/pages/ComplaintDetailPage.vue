<template>
  <div v-loading="loading" class="c-detail">
    <header class="c-detail__header">
      <h1 class="c-detail__title">客诉详情</h1>
      <div class="c-detail__actions">
        <el-button @click="router.push('/complaints')">返回列表</el-button>
        <el-button
          v-if="complaint && complaint.status === 'registered'"
          type="primary"
          @click="showFollow = true"
        >
          跟进 / 确认解决
        </el-button>
      </div>
    </header>

    <el-card v-if="complaint" class="c-detail__card">
      <template #header>客诉信息</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="描述">{{ complaint.description }}</el-descriptions-item>
        <el-descriptions-item label="类型">{{ typeLabel(complaint.type) }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="complaint.status === 'resolved' ? 'success' : 'danger'">
            {{ complaint.status === 'resolved' ? '已解决' : '处理中' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="下次确认">{{
          complaint.nextFollowUpDate ?? '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="解决结果" :span="2">{{
          complaint.resolution ?? '-'
        }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="complaint" class="c-detail__card">
      <template #header>跟进记录</template>
      <el-timeline>
        <el-timeline-item
          v-for="f in complaint.followUps"
          :key="f.id"
          :timestamp="formatTime(f.occurredAt)"
        >
          {{ f.content }}（{{ f.outcome === 'resolved' ? '已解决' : '继续跟进' }}）
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <el-dialog v-model="showFollow" title="跟进客诉" width="420px">
      <el-form label-width="90px">
        <el-form-item label="处理确认" required><el-input v-model="form.content" /></el-form-item>
        <el-form-item label="结果" required>
          <el-radio-group v-model="form.outcome">
            <el-radio value="followed_up">继续跟进</el-radio>
            <el-radio value="resolved">确认解决</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.outcome === 'resolved'" label="解决结果" required>
          <el-input v-model="form.resolution" />
        </el-form-item>
        <el-form-item v-else label="下次确认" required>
          <el-input v-model="form.nextFollowUpDate" placeholder="YYYY-MM-DD" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showFollow = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="handleFollow">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useQuery, getComplaint, followUpComplaint, COMPLAINT_TYPE_OPTIONS } from '@crm/domain'

const route = useRoute()
const router = useRouter()
const complaintId = route.params.id as string

const {
  data: complaint,
  loading,
  reload,
} = useQuery(`complaint:detail:${complaintId}`, () => getComplaint(complaintId))
const showFollow = ref(false)
const acting = ref(false)
const form = reactive({
  content: '',
  outcome: 'followed_up' as 'followed_up' | 'resolved',
  resolution: '',
  nextFollowUpDate: '',
})

function typeLabel(type: string): string {
  return COMPLAINT_TYPE_OPTIONS.find((t) => t.value === type)?.label ?? type
}
function formatTime(v: string): string {
  return v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '-'
}

async function handleFollow() {
  if (!form.content.trim()) return ElMessage.warning('请填写处理确认')
  if (form.outcome === 'resolved' && !form.resolution.trim())
    return ElMessage.warning('请填写解决结果')
  if (form.outcome === 'followed_up' && !form.nextFollowUpDate)
    return ElMessage.warning('请填写下次确认日期')
  acting.value = true
  try {
    await followUpComplaint(complaintId, {
      content: form.content.trim(),
      outcome: form.outcome,
      resolution: form.outcome === 'resolved' ? form.resolution.trim() : undefined,
      nextFollowUpDate: form.outcome === 'followed_up' ? form.nextFollowUpDate : undefined,
    })
    ElMessage.success('已记录')
    showFollow.value = false
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    acting.value = false
  }
}
</script>

<style scoped>
.c-detail {
  padding: var(--crm-spacing-xl);
}
.c-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-lg);
}
.c-detail__title {
  margin: 0;
  color: var(--crm-color-text-primary);
}
.c-detail__actions {
  display: flex;
  gap: var(--crm-spacing-sm);
}
.c-detail__card {
  max-width: 860px;
  margin-bottom: var(--crm-spacing-lg);
}
</style>
