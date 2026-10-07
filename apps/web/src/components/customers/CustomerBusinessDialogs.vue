<template>
  <el-dialog v-model="visible.visit" title="记录拜访" width="520px">
    <el-alert
      v-if="sourcePlan"
      class="business-dialog__plan"
      type="info"
      :closable="false"
      :title="`本次执行计划：${formatPlanTime(sourcePlan.plannedAt)} · ${sourcePlan.content}`"
    />
    <el-form label-width="100px">
      <el-form-item label="客户">
        <span class="business-dialog__customer-name">{{ customerName }}</span>
      </el-form-item>
      <el-form-item label="拜访日期" required>
        <el-date-picker v-model="visitForm.occurredAt" type="date" value-format="YYYY-MM-DD" />
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
      <el-form-item label="本次情况" :required="visitRules.businessSituationMinLength > 0">
        <el-input
          v-model="visitForm.businessSituation"
          type="textarea"
          :rows="3"
          placeholder="客户经营、需求或本次沟通要点"
        />
        <span v-if="visitRules.businessSituationMinLength" class="business-dialog__length-hint">
          {{ visitTextLength(visitForm.businessSituation) }} / 至少
          {{ visitRules.businessSituationMinLength }} 字
        </span>
      </el-form-item>
      <el-form-item label="下次拜访内容" required>
        <el-input
          v-model="visitForm.nextActionContent"
          type="textarea"
          :rows="3"
          placeholder="下一步具体做什么"
        />
        <span v-if="visitRules.nextActionContentMinLength" class="business-dialog__length-hint">
          {{ visitTextLength(visitForm.nextActionContent) }} / 至少
          {{ visitRules.nextActionContentMinLength }} 字
        </span>
      </el-form-item>
      <el-form-item label="下次日期" required>
        <el-date-picker v-model="visitForm.nextActionAt" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible.visit = false">取消</el-button>
      <el-button type="primary" :loading="saving || checkingRules" @click="submitVisit">
        保存拜访
      </el-button>
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
      <el-form-item label="客户">
        <span class="business-dialog__customer-name">{{ customerName }}</span>
      </el-form-item>
      <el-form-item label="发生日期" required>
        <el-date-picker v-model="complaintForm.occurredAt" type="date" value-format="YYYY-MM-DD" />
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
      <el-form-item label="计划日期" required>
        <el-date-picker
          v-model="complaintForm.firstActionAt"
          type="date"
          value-format="YYYY-MM-DD"
        />
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
  getVisitEntryRules,
  listDimensionOptions,
  visitEntryValidationError,
  visitTextLength,
  DEFAULT_VISIT_ENTRY_RULES,
  type DimensionOption,
  type VisitEntryRules,
  type VisitMethod,
  type SalesPlan,
} from '@crm/domain'

const props = defineProps<{
  customerId: string
  customerName: string
  currentVisitPlan?: SalesPlan
}>()
const emit = defineEmits<{
  changed: [kind: 'visit' | 'opportunity' | 'complaint', recordId: string]
}>()

const visible = reactive({ visit: false, complaint: false })
const saving = ref(false)
const checkingRules = ref(false)
const visitRules = ref<VisitEntryRules>({ ...DEFAULT_VISIT_ENTRY_RULES })
const opportunityDialog = ref<InstanceType<typeof OpportunityCreateDialog>>()
const sourcePlan = ref<SalesPlan>()
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
  const occurredAt = occurredDate ?? today()
  const existingPlan = plan ? undefined : props.currentVisitPlan
  Object.assign(visitForm, {
    occurredAt,
    method: 'offline_visit',
    visitType: undefined,
    businessSituation: '',
    nextActionContent: existingPlan?.content ?? '',
    nextActionAt: existingPlan ? existingPlan.plannedAt : tomorrow(),
  })
  visible.visit = true
  void getVisitEntryRules()
    .then((rules) => (visitRules.value = rules))
    .catch(() => ElMessage.error('拜访填报规则加载失败，提交时将重试'))
}

function openOpportunity() {
  opportunityDialog.value?.open()
}

function openComplaint(occurredDate?: string) {
  const occurredAt = occurredDate ?? today()
  Object.assign(complaintForm, {
    occurredAt,
    type: '',
    description: '',
    firstActionContent: '',
    firstActionAt: nextDate(occurredAt),
  })
  visible.complaint = true
}

async function submitVisit() {
  if (checkingRules.value || saving.value) return
  if (!visitForm.occurredAt || !visitForm.method) return ElMessage.warning('请填写沟通时间和方式')
  if (!visitForm.nextActionAt || !visitForm.nextActionContent.trim())
    return ElMessage.warning('请填写下次拜访时间和内容')
  checkingRules.value = true
  try {
    const rules = await getVisitEntryRules()
    visitRules.value = rules
    const validationError = visitEntryValidationError(
      rules,
      visitForm.businessSituation,
      visitForm.nextActionContent,
    )
    if (validationError) return ElMessage.warning(validationError)
  } catch (error) {
    return ElMessage.error(error instanceof Error ? error.message : '拜访填报规则加载失败')
  } finally {
    checkingRules.value = false
  }
  await run(
    () =>
      createVisit({
        customerId: props.customerId,
        occurredAt: visitForm.occurredAt,
        method: visitForm.method,
        visitType: visitForm.visitType,
        businessSituation: visitForm.businessSituation.trim() || undefined,
        sourcePlanId: sourcePlan.value?.id,
        nextActionContent: visitForm.nextActionContent.trim(),
        nextActionAt: visitForm.nextActionAt,
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
        occurredAt: complaintForm.occurredAt,
        type: complaintForm.type,
        description: complaintForm.description.trim(),
        firstActionContent: complaintForm.firstActionContent.trim(),
        firstActionAt: complaintForm.firstActionAt,
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

function tomorrow(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return localDate(date)
}

function localDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function today(): string {
  return localDate(new Date())
}

function nextDate(value: string): string {
  const date = new Date(`${value}T00:00:00`)
  date.setDate(date.getDate() + 1)
  return localDate(date)
}

function formatPlanTime(value: string): string {
  return value
}

defineExpose({ openVisit, openOpportunity, openComplaint })
</script>

<style scoped>
.business-dialog__plan {
  margin-bottom: var(--crm-spacing-md);
}
.business-dialog__customer-name {
  font-weight: 600;
  overflow-wrap: anywhere;
}
.business-dialog__length-hint {
  width: 100%;
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
  text-align: right;
}
</style>
