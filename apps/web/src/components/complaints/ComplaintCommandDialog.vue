<template>
  <el-dialog v-model="visible" title="跟进客诉" width="420px">
    <el-alert
      v-if="executingPlan"
      class="complaint-dialog__plan"
      type="info"
      :closable="false"
      :title="`本次执行计划：${executingPlan.plannedAt} · ${executingPlan.content}`"
    />
    <el-form label-width="90px">
      <el-form-item label="处理确认" required>
        <el-input v-model="form.content" />
      </el-form-item>
      <el-form-item label="结果" required>
        <el-radio-group v-model="form.outcome">
          <el-radio value="followed_up">继续跟进</el-radio>
          <el-radio value="resolved">确认解决</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.outcome === 'resolved'" label="解决结果" required>
        <el-input v-model="form.resolution" />
      </el-form-item>
      <template v-else>
        <el-form-item label="下一计划" required>
          <el-input v-model="form.nextActionContent" placeholder="下一步具体做什么" />
        </el-form-item>
        <el-form-item label="计划日期" required>
          <el-date-picker v-model="form.nextActionAt" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
      </template>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  followUpComplaint,
  localBusinessDate,
  type ComplaintDetail,
  type SalesPlan,
} from '@crm/domain'

const props = defineProps<{ complaint: ComplaintDetail }>()
const emit = defineEmits<{ changed: [] }>()
const visible = ref(false)
const saving = ref(false)
const executingPlan = ref<SalesPlan>()
const form = reactive({
  content: '',
  outcome: 'followed_up' as 'followed_up' | 'resolved',
  resolution: '',
  nextActionContent: '',
  nextActionAt: '',
})

function open(plan?: SalesPlan) {
  executingPlan.value = plan
  form.content = ''
  form.outcome = 'followed_up'
  form.resolution = ''
  const currentPlan = plan ? undefined : props.complaint.actions[0]
  form.nextActionContent = currentPlan?.content ?? ''
  form.nextActionAt = currentPlan?.plannedAt ?? localBusinessDate(tomorrow())
  visible.value = true
}

async function submit() {
  if (!form.content.trim()) return ElMessage.warning('请填写处理确认')
  if (form.outcome === 'resolved' && !form.resolution.trim()) {
    return ElMessage.warning('请填写解决结果')
  }
  if (form.outcome === 'followed_up' && (!form.nextActionAt || !form.nextActionContent.trim())) {
    return ElMessage.warning('请填写下一计划和计划日期')
  }
  saving.value = true
  try {
    await followUpComplaint(props.complaint.id, {
      version: props.complaint.version,
      content: form.content.trim(),
      outcome: form.outcome,
      resolution: form.outcome === 'resolved' ? form.resolution.trim() : undefined,
      sourcePlanId: executingPlan.value?.id,
      nextActionAt: form.outcome === 'followed_up' ? form.nextActionAt : undefined,
      nextActionContent: form.outcome === 'followed_up' ? form.nextActionContent.trim() : undefined,
    })
    visible.value = false
    ElMessage.success('客诉处理已记录')
    emit('changed')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

function tomorrow(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date
}

defineExpose({ open })
</script>

<style scoped>
.complaint-dialog__plan {
  margin-bottom: var(--crm-spacing-md);
}
</style>
