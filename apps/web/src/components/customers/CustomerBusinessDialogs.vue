<template>
  <el-dialog v-model="visible.visit" title="记录拜访" width="520px">
    <el-alert
      v-if="sourcePlan"
      class="business-dialog__plan"
      type="info"
      :closable="false"
      :title="`原计划：${formatPlanTime(sourcePlan.plannedAt)} · ${sourcePlan.content}`"
    />
    <el-alert
      v-else-if="currentVisitPlan"
      class="business-dialog__plan"
      type="warning"
      :closable="false"
      :title="`已有计划：${formatPlanTime(currentVisitPlan.plannedAt)} · ${currentVisitPlan.content}`"
    />
    <el-form label-width="100px">
      <el-form-item v-if="!sourcePlan && currentVisitPlan" label="与原计划">
        <el-radio-group v-model="planHandling">
          <el-radio value="execute">关联并完成原计划</el-radio>
          <el-radio value="keep">本次为临时拜访，保留原计划</el-radio>
        </el-radio-group>
      </el-form-item>
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
            v-for="option in visitTypeOptions"
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
      <el-form-item v-if="planHandling !== 'keep'" label="下次拜访" required>
        <el-input v-model="visitForm.nextActionContent" placeholder="下一步具体做什么" />
      </el-form-item>
      <el-form-item v-if="planHandling !== 'keep'" label="下次时间" required>
        <el-input v-model="visitForm.nextActionAt" type="datetime-local" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible.visit = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submitVisit">保存拜访</el-button>
    </template>
  </el-dialog>

  <OpportunityCreateDialog
    ref="opportunityDialog"
    :customer-id="customerId"
    :customer-name="customerName"
    @created="handleOpportunityCreated"
  />

  <el-dialog v-model="visible.complaint" title="登记客诉" width="520px">
    <el-form label-width="100px">
      <el-form-item label="发生时间" required>
        <el-input v-model="complaintForm.occurredAt" type="datetime-local" />
      </el-form-item>
      <el-form-item label="客诉类型" required>
        <el-select v-model="complaintForm.type" style="width: 100%">
          <el-option
            v-for="option in complaintTypeOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="问题描述" required>
        <el-input v-model="complaintForm.description" type="textarea" :rows="3" />
      </el-form-item>
      <el-form-item label="第一步计划" required>
        <el-input v-model="complaintForm.firstActionContent" placeholder="如：联系售后确认处理人" />
      </el-form-item>
      <el-form-item label="计划时间" required>
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
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import OpportunityCreateDialog from '../opportunities/OpportunityCreateDialog.vue'
import {
  VISIT_METHOD_OPTIONS,
  createComplaint,
  createVisit,
  listDimensionOptions,
  type DimensionOption,
  type VisitMethod,
  type SalesPlan,
} from '@crm/domain'

const props = defineProps<{
  customerId: string
  customerName?: string
  currentVisitPlan?: SalesPlan
}>()
const emit = defineEmits<{
  changed: [kind: 'visit' | 'opportunity' | 'complaint', recordId: string]
}>()

const visible = reactive({ visit: false, complaint: false })
const saving = ref(false)
const opportunityDialog = ref<InstanceType<typeof OpportunityCreateDialog>>()
const sourcePlan = ref<SalesPlan>()
const planHandling = ref<'execute' | 'keep' | 'new'>('new')
const visitTypeOptions = ref<SelectOption[]>([])
const complaintTypeOptions = ref<SelectOption[]>([])

type SelectOption = { value: string; label: string }

function asSelectOptions(options: DimensionOption[]): SelectOption[] {
  return options
    .filter((option) => option.isActive)
    .map((option) => ({ value: option.name, label: option.label }))
}

onMounted(async () => {
  try {
    const [visitTypes, complaintTypes] = await Promise.all([
      listDimensionOptions('visit_type'),
      listDimensionOptions('complaint_type'),
    ])
    visitTypeOptions.value = asSelectOptions(visitTypes)
    complaintTypeOptions.value = asSelectOptions(complaintTypes)
  } catch {
    ElMessage.error('业务分类加载失败，请稍后重试')
  }
})
const visitForm = reactive({
  occurredAt: '',
  method: 'offline_visit' as VisitMethod,
  visitType: undefined as string | undefined,
  businessSituation: '',
  nextActionContent: '',
  nextActionAt: '',
})
const complaintForm = reactive({
  occurredAt: '',
  type: '',
  description: '',
  firstActionContent: '',
  firstActionAt: '',
})

function openVisit(plan?: SalesPlan, occurredDate?: string) {
  sourcePlan.value = plan
  planHandling.value = plan ? 'execute' : props.currentVisitPlan ? 'execute' : 'new'
  const occurredAt = occurredDate ? new Date(`${occurredDate}T09:00:00`) : new Date()
  Object.assign(visitForm, {
    occurredAt: localInput(occurredAt),
    method: 'offline_visit',
    visitType: undefined,
    businessSituation: '',
    nextActionContent: '',
    nextActionAt: localInput(tomorrowAtNine()),
  })
  visible.visit = true
}

function openOpportunity() {
  opportunityDialog.value?.open()
}

function openComplaint(occurredDate?: string) {
  const occurredAt = occurredDate ? new Date(`${occurredDate}T09:00:00`) : new Date()
  const firstActionAt = new Date(occurredAt)
  firstActionAt.setDate(firstActionAt.getDate() + 1)
  firstActionAt.setHours(9, 0, 0, 0)
  Object.assign(complaintForm, {
    occurredAt: localInput(occurredAt),
    type: '',
    description: '',
    firstActionContent: '',
    firstActionAt: localInput(firstActionAt),
  })
  visible.complaint = true
}

async function submitVisit() {
  if (!visitForm.occurredAt || !visitForm.method) return ElMessage.warning('请填写沟通时间和方式')
  if (
    planHandling.value !== 'keep' &&
    (!visitForm.nextActionAt || !visitForm.nextActionContent.trim())
  )
    return ElMessage.warning('请填写下次拜访时间和内容')
  const linkedPlan =
    sourcePlan.value ?? (planHandling.value === 'execute' ? props.currentVisitPlan : undefined)
  await run(
    () =>
      createVisit({
        customerId: props.customerId,
        occurredAt: new Date(visitForm.occurredAt).toISOString(),
        method: visitForm.method,
        visitType: visitForm.visitType,
        businessSituation: visitForm.businessSituation.trim() || undefined,
        sourcePlanId: linkedPlan?.id,
        keepExistingPlan: planHandling.value === 'keep' || undefined,
        nextActionContent:
          planHandling.value === 'keep' ? undefined : visitForm.nextActionContent.trim(),
        nextActionAt:
          planHandling.value === 'keep'
            ? undefined
            : new Date(visitForm.nextActionAt).toISOString(),
      }),
    'visit',
    '拜访已记录',
  )
}

function handleOpportunityCreated(id: string) {
  emit('changed', 'opportunity', id)
}

async function submitComplaint() {
  if (
    !complaintForm.occurredAt ||
    !complaintForm.type ||
    !complaintForm.description.trim() ||
    !complaintForm.firstActionContent.trim() ||
    !complaintForm.firstActionAt
  )
    return ElMessage.warning('请填写客诉信息和第一步计划')
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
  kind: 'visit' | 'complaint',
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

function formatPlanTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

defineExpose({ openVisit, openOpportunity, openComplaint })
</script>

<style scoped>
.business-dialog__plan {
  margin-bottom: var(--crm-spacing-md);
}
</style>
