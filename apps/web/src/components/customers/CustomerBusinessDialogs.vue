<template>
  <el-dialog v-model="visible.visit" title="记录拜访" width="520px">
    <el-form label-width="100px">
      <el-form-item label="沟通时间" required>
        <el-input v-model="visitForm.occurredAt" type="datetime-local" />
      </el-form-item>
      <el-form-item label="方式" required>
        <el-select v-model="visitForm.method" style="width: 100%">
          <el-option
            v-for="option in VISIT_METHOD_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="拜访类型">
        <el-select v-model="visitForm.visitType" clearable style="width: 100%">
          <el-option
            v-for="option in VISIT_TYPE_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="本次情况">
        <el-input
          v-model="visitForm.businessSituation"
          type="textarea"
          :rows="3"
          placeholder="客户经营、需求或本次沟通要点"
        />
      </el-form-item>
      <el-form-item label="下一行动">
        <el-input v-model="visitForm.nextActionContent" placeholder="下一步具体做什么" />
      </el-form-item>
      <el-form-item label="行动时间">
        <el-input v-model="visitForm.nextActionAt" type="datetime-local" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible.visit = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitVisit">保存拜访</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="visible.opportunity" title="新建商机" width="520px">
    <el-form label-width="100px">
      <el-form-item label="需求简述" required>
        <el-input v-model="opportunityForm.name" placeholder="客户要解决什么问题" />
      </el-form-item>
      <el-form-item label="发现渠道" required>
        <el-select v-model="opportunityForm.source" style="width: 100%">
          <el-option
            v-for="option in OPPORTUNITY_SOURCE_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="意向规模" required>
        <el-input v-model.number="opportunityForm.estimatedAmount" type="number">
          <template #append>元</template>
        </el-input>
      </el-form-item>
      <el-form-item label="第一步行动" required>
        <el-input v-model="opportunityForm.firstActionContent" placeholder="如：确认选型参数" />
      </el-form-item>
      <el-form-item label="行动时间" required>
        <el-input v-model="opportunityForm.firstActionAt" type="datetime-local" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible.opportunity = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitOpportunity">创建商机</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="visible.complaint" title="登记客诉" width="520px">
    <el-form label-width="100px">
      <el-form-item label="发生时间" required>
        <el-input v-model="complaintForm.occurredAt" type="datetime-local" />
      </el-form-item>
      <el-form-item label="客诉类型" required>
        <el-select v-model="complaintForm.type" style="width: 100%">
          <el-option
            v-for="option in COMPLAINT_TYPE_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="问题描述" required>
        <el-input v-model="complaintForm.description" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="第一步行动" required>
        <el-input v-model="complaintForm.firstActionContent" placeholder="如：联系售后确认处理人" />
      </el-form-item>
      <el-form-item label="行动时间" required>
        <el-input v-model="complaintForm.firstActionAt" type="datetime-local" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible.complaint = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitComplaint">登记客诉</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  COMPLAINT_TYPE_OPTIONS,
  OPPORTUNITY_SOURCE_OPTIONS,
  VISIT_METHOD_OPTIONS,
  VISIT_TYPE_OPTIONS,
  createComplaint,
  createOpportunity,
  createVisit,
  type VisitMethod,
} from '@crm/domain'

const props = defineProps<{ customerId: string }>()
const emit = defineEmits<{
  changed: [kind: 'visit' | 'opportunity' | 'complaint', recordId: string]
}>()

const visible = reactive({ visit: false, opportunity: false, complaint: false })
const saving = ref(false)
const visitForm = reactive({
  occurredAt: '',
  method: 'offline_visit' as VisitMethod,
  visitType: undefined as string | undefined,
  businessSituation: '',
  nextActionContent: '',
  nextActionAt: '',
})
const opportunityForm = reactive({
  name: '',
  source: '',
  estimatedAmount: undefined as number | undefined,
  firstActionContent: '',
  firstActionAt: '',
})
const complaintForm = reactive({
  occurredAt: '',
  type: '',
  description: '',
  firstActionContent: '',
  firstActionAt: '',
})

function openVisit() {
  Object.assign(visitForm, {
    occurredAt: localInput(new Date()),
    method: 'offline_visit',
    visitType: undefined,
    businessSituation: '',
    nextActionContent: '',
    nextActionAt: '',
  })
  visible.visit = true
}

function openOpportunity() {
  Object.assign(opportunityForm, {
    name: '',
    source: '',
    estimatedAmount: undefined,
    firstActionContent: '',
    firstActionAt: localInput(tomorrowAtNine()),
  })
  visible.opportunity = true
}

function openComplaint() {
  Object.assign(complaintForm, {
    occurredAt: localInput(new Date()),
    type: '',
    description: '',
    firstActionContent: '',
    firstActionAt: localInput(tomorrowAtNine()),
  })
  visible.complaint = true
}

async function submitVisit() {
  if (!visitForm.occurredAt || !visitForm.method) return ElMessage.warning('请填写沟通时间和方式')
  if (!!visitForm.nextActionAt !== !!visitForm.nextActionContent.trim())
    return ElMessage.warning('下一行动内容和时间需要同时填写')
  await run(
    () =>
      createVisit({
        customerId: props.customerId,
        occurredAt: new Date(visitForm.occurredAt).toISOString(),
        method: visitForm.method,
        visitType: visitForm.visitType,
        businessSituation: visitForm.businessSituation.trim() || undefined,
        nextActionContent: visitForm.nextActionContent.trim() || undefined,
        nextActionAt: visitForm.nextActionAt
          ? new Date(visitForm.nextActionAt).toISOString()
          : undefined,
      }),
    'visit',
    '拜访已记录',
  )
}

async function submitOpportunity() {
  if (
    !opportunityForm.name.trim() ||
    !opportunityForm.source ||
    opportunityForm.estimatedAmount == null ||
    !opportunityForm.firstActionContent.trim() ||
    !opportunityForm.firstActionAt
  )
    return ElMessage.warning('请填写需求、渠道、意向规模和第一步行动')
  await run(
    () =>
      createOpportunity({
        customerId: props.customerId,
        name: opportunityForm.name.trim(),
        source: opportunityForm.source,
        estimatedAmount: opportunityForm.estimatedAmount!,
        firstActionContent: opportunityForm.firstActionContent.trim(),
        firstActionAt: new Date(opportunityForm.firstActionAt).toISOString(),
      }),
    'opportunity',
    '商机已创建',
  )
}

async function submitComplaint() {
  if (
    !complaintForm.occurredAt ||
    !complaintForm.type ||
    !complaintForm.description.trim() ||
    !complaintForm.firstActionContent.trim() ||
    !complaintForm.firstActionAt
  )
    return ElMessage.warning('请填写客诉信息和第一步行动')
  await run(
    () =>
      createComplaint({
        customerId: props.customerId,
        occurredAt: new Date(complaintForm.occurredAt).toISOString(),
        type: complaintForm.type,
        description: complaintForm.description.trim(),
        firstActionContent: complaintForm.firstActionContent.trim(),
        firstActionAt: new Date(complaintForm.firstActionAt).toISOString(),
      }),
    'complaint',
    '客诉已登记',
  )
}

async function run(
  operation: () => Promise<{ id: string }>,
  kind: 'visit' | 'opportunity' | 'complaint',
  message: string,
) {
  saving.value = true
  try {
    const result = await operation()
    visible[kind] = false
    ElMessage.success(message)
    emit('changed', kind, result.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    saving.value = false
  }
}

function tomorrowAtNine(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return date
}

function localInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

defineExpose({ openVisit, openOpportunity, openComplaint })
</script>
