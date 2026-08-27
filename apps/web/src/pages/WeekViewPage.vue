<template>
  <div class="week-view">
    <AppPageHeader title="销售计划周视图" :description="weekLabel">
      <template #actions>
        <el-button-group>
          <el-button @click="shiftWeek(-1)">上一周</el-button>
          <el-button @click="goToday">本周</el-button>
          <el-button @click="shiftWeek(1)">下一周</el-button>
        </el-button-group>
      </template>
    </AppPageHeader>

    <AppQueryState :error="error" @retry="reload" />

    <el-alert
      v-if="!error && view?.overdue.length"
      class="week-view__overdue"
      type="warning"
      :closable="false"
      :title="`还有 ${view.overdue.length} 项更早计划未执行`"
    >
      <div v-for="action in view.overdue" :key="action.id" class="overdue-row">
        <span
          >{{ formatDateTime(action.plannedAt) }} · {{ planLabel(action.planKind) }} ·
          {{ action.customerName }} · {{ action.content }}</span
        >
        <FollowUpActionMenu :action="action" @command="handleActionCommand" />
      </div>
    </el-alert>

    <el-card v-if="!error" v-loading="loading" class="week-view__card">
      <div class="week-view__grid">
        <div
          v-for="day in days"
          :key="day.date"
          class="week-view__col"
          :class="{ 'week-view__col--today': day.isToday }"
        >
          <div class="week-view__col-head">
            <span>{{ day.weekday }}</span>
            <span :class="{ 'week-view__date--today': day.isToday }">{{ day.monthDay }}</span>
          </div>

          <div class="week-view__body">
            <div class="week-view__section-title">计划</div>
            <div
              v-for="action in day.plans"
              :key="action.id"
              class="week-view__item"
              :class="{
                'week-view__item--completed': action.status === 'completed',
                'week-view__item--cancelled': action.status === 'cancelled',
              }"
            >
              <div class="week-view__item-head">
                <span>{{ planLabel(action.planKind) }}</span>
                <small>{{ timeOnly(action.plannedAt) }}</small>
              </div>
              <strong class="week-view__customer">{{ action.customerName }}</strong>
              <small v-if="action.opportunityName">{{ action.opportunityName }}</small>
              <div :title="action.content">{{ action.content }}</div>
              <small v-if="action.status === 'completed'" class="week-view__state">已执行</small>
              <small v-else-if="action.status === 'cancelled'" class="week-view__state">
                {{ action.cancelReason }}
              </small>
              <FollowUpActionMenu
                v-if="action.status === 'pending'"
                :action="action"
                @command="handleActionCommand"
              />
            </div>
            <div v-if="day.plans.length === 0" class="week-view__empty">暂无计划</div>

            <div class="week-view__section-title">业务记录</div>
            <div v-for="record in day.businessRecords" :key="record.id" class="week-view__record">
              <div class="week-view__item-head">
                <span>{{ recordLabel(record.type) }}</span
                ><small>{{ timeOnly(record.occurredAt) }}</small>
              </div>
              <strong class="week-view__customer">{{ record.customerName }}</strong>
              <small v-if="record.opportunityName">{{ record.opportunityName }}</small>
              <div>{{ record.summary }}</div>
            </div>
            <div v-if="day.businessRecords.length === 0" class="week-view__empty">暂无业务记录</div>

            <div class="week-view__section-title">客诉</div>
            <div
              v-for="record in day.complaintRecords"
              :key="record.id"
              class="week-view__record week-view__record--complaint"
            >
              <div class="week-view__item-head">
                <span>{{ record.type === 'complaint_registered' ? '客诉登记' : '客诉跟进' }}</span>
                <small>{{ timeOnly(record.occurredAt) }}</small>
              </div>
              <strong class="week-view__customer">{{ record.customerName }}</strong>
              <div>{{ record.summary }}</div>
            </div>
            <div v-if="day.complaintRecords.length === 0" class="week-view__empty">暂无客诉</div>

            <div class="week-view__add">
              <span @click="onBlankClick(day)">＋ 安排计划</span>
              <span @click="openRecordDialog(day)">＋ 记录实际</span>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-dialog v-model="showDialog" :title="`安排销售计划（${dialogDate}）`" width="520px">
      <el-form label-width="90px">
        <el-form-item label="计划类型" required>
          <el-radio-group v-model="planForm.planKind" @change="onPlanKindChange">
            <el-radio value="customer_visit">客户拜访</el-radio>
            <el-radio value="opportunity_follow_up">商机跟进</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="客户" required>
          <el-select
            v-model="planForm.customerId"
            filterable
            style="width: 100%"
            placeholder="选择客户"
            @change="loadOpportunityOptions"
          >
            <el-option
              v-for="customer in customerOptions"
              :key="customer.id"
              :label="customer.name"
              :value="customer.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="planForm.planKind === 'opportunity_follow_up'" label="商机" required>
          <el-select
            v-model="planForm.opportunityId"
            style="width: 100%"
            placeholder="选择仍在推进的商机"
          >
            <el-option
              v-for="opportunity in opportunityOptions"
              :key="opportunity.id"
              :label="opportunity.name"
              :value="opportunity.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="计划时间" required>
          <el-input v-model="planForm.plannedAt" type="datetime-local" />
        </el-form-item>
        <el-form-item label="计划内容" required>
          <el-input
            v-model="planForm.content"
            placeholder="写给自己看的下一步安排"
            maxlength="150"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submitPlan">保存计划</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="actionDialog.visible"
      :title="actionDialog.mode === 'reschedule' ? '计划改期' : '替换计划'"
      width="420px"
    >
      <el-form label-width="80px">
        <el-form-item v-if="actionDialog.mode === 'reschedule'" label="新时间" required>
          <el-input v-model="actionDialog.plannedAt" type="datetime-local" />
        </el-form-item>
        <template v-else>
          <el-form-item label="新时间" required>
            <el-input v-model="actionDialog.plannedAt" type="datetime-local" />
          </el-form-item>
          <el-form-item label="新内容" required>
            <el-input v-model="actionDialog.content" maxlength="150" />
          </el-form-item>
          <el-form-item label="替换原因" required>
            <el-input
              v-model="actionDialog.reason"
              type="textarea"
              :rows="3"
              placeholder="说明为什么改成另一项安排"
            />
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="actionDialog.visible = false">返回</el-button>
        <el-button type="primary" :loading="actionDialog.saving" @click="submitActionCommand">
          {{ actionDialog.mode === 'replace' ? '确认替换' : '确认改期' }}
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recordDialog.visible" title="记录当日实际" width="520px">
      <el-form label-width="90px">
        <el-form-item label="记录类型" required>
          <el-radio-group v-model="recordDialog.type">
            <el-radio value="customer_visit">客户拜访</el-radio>
            <el-radio value="opportunity_follow_up">商机跟进</el-radio>
            <el-radio value="opportunity_quote">报价记录</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="客户" required>
          <el-select
            v-model="recordDialog.customerId"
            filterable
            style="width: 100%"
            @change="loadRecordOpportunities"
          >
            <el-option
              v-for="customer in customerOptions"
              :key="customer.id"
              :label="customer.name"
              :value="customer.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item v-if="recordDialog.type !== 'customer_visit'" label="商机" required>
          <el-select v-model="recordDialog.opportunityId" style="width: 100%">
            <el-option
              v-for="opportunity in recordOpportunityOptions"
              :key="opportunity.id"
              :label="opportunity.name"
              :value="opportunity.id"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="recordDialog.visible = false">返回</el-button>
        <el-button type="primary" @click="continueRecord">继续填写</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import FollowUpActionMenu from '../components/actions/FollowUpActionMenu.vue'
import {
  createSalesPlan,
  getWeekView,
  listCustomers,
  listOpportunities,
  replaceSalesPlan,
  rescheduleSalesPlan,
  useQuery,
  type CustomerItem,
  type Opportunity,
  type SalesPlan,
  type SalesPlanKind,
  type WeekBusinessRecord,
  type WeekComplaintRecord,
} from '@crm/domain'

type ActionCommand = 'execute' | 'reschedule' | 'replace'

const router = useRouter()

const today = new Date()
const todayStr = fmt(today)
const weekOffset = ref(0)

const range = computed(() => {
  const dow = (today.getDay() + 6) % 7
  const monday = new Date(today)
  monday.setDate(today.getDate() - dow + weekOffset.value * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday: fmt(monday), sunday: fmt(sunday) }
})
const weekLabel = computed(() => {
  const start = new Date(`${range.value.monday}T00:00:00`)
  return `${start.getMonth() + 1}月${start.getDate()}日开始的一周`
})

const {
  data: view,
  loading,
  error,
  reload,
} = useQuery('web-week-view', () => getWeekView(range.value.monday, range.value.sunday))
watch(weekOffset, () => void reload())

interface DayVM {
  date: string
  weekday: string
  monthDay: string
  isToday: boolean
  plans: SalesPlan[]
  businessRecords: WeekBusinessRecord[]
  complaintRecords: WeekComplaintRecord[]
}

const days = computed<DayVM[]>(() => {
  const actionMap = new Map<string, SalesPlan[]>()
  const businessMap = new Map<string, WeekBusinessRecord[]>()
  const complaintMap = new Map<string, WeekComplaintRecord[]>()
  for (const action of view.value?.plans ?? []) {
    const date = fmt(new Date(action.plannedAt))
    actionMap.set(date, [...(actionMap.get(date) ?? []), action])
  }
  for (const record of view.value?.businessRecords ?? []) {
    const date = fmt(new Date(record.occurredAt))
    businessMap.set(date, [...(businessMap.get(date) ?? []), record])
  }
  for (const record of view.value?.complaintRecords ?? []) {
    const date = fmt(new Date(record.occurredAt))
    complaintMap.set(date, [...(complaintMap.get(date) ?? []), record])
  }
  const result: DayVM[] = []
  for (let index = 0; index < 7; index++) {
    const dateValue = new Date(`${range.value.monday}T00:00:00`)
    dateValue.setDate(dateValue.getDate() + index)
    const date = fmt(dateValue)
    result.push({
      date,
      weekday: '周' + '一二三四五六日'[(dateValue.getDay() + 6) % 7],
      monthDay: `${dateValue.getMonth() + 1}/${dateValue.getDate()}`,
      isToday: date === todayStr,
      plans: actionMap.get(date) ?? [],
      businessRecords: businessMap.get(date) ?? [],
      complaintRecords: complaintMap.get(date) ?? [],
    })
  }
  return result
})

function shiftWeek(offset: number) {
  weekOffset.value += offset
}
function goToday() {
  weekOffset.value = 0
}

const selectedAction = ref<SalesPlan>()
const actionDialog = reactive({
  visible: false,
  mode: 'reschedule' as 'reschedule' | 'replace',
  plannedAt: '',
  content: '',
  reason: '',
  saving: false,
})

function handleActionCommand(command: ActionCommand, action: SalesPlan) {
  if (command === 'execute') {
    void router.push(executionRoute(action))
    return
  }
  selectedAction.value = action
  actionDialog.mode = command
  actionDialog.plannedAt = localInput(action.plannedAt)
  actionDialog.content = action.content
  actionDialog.reason = ''
  actionDialog.visible = true
}

async function submitActionCommand() {
  const action = selectedAction.value
  if (!action) return
  if (actionDialog.mode === 'reschedule' && !actionDialog.plannedAt)
    return ElMessage.warning('请选择新的计划时间')
  if (
    actionDialog.mode === 'replace' &&
    (!actionDialog.content.trim() || !actionDialog.reason.trim())
  )
    return ElMessage.warning('请填写新计划内容和替换原因')
  actionDialog.saving = true
  try {
    if (actionDialog.mode === 'reschedule') {
      await rescheduleSalesPlan(
        action.id,
        action.version,
        new Date(actionDialog.plannedAt).toISOString(),
      )
      ElMessage.success('计划已改期')
    } else {
      await replaceSalesPlan(
        action.id,
        action.version,
        new Date(actionDialog.plannedAt).toISOString(),
        actionDialog.content.trim(),
        actionDialog.reason.trim(),
      )
      ElMessage.success('计划已替换，跟进链保持连续')
    }
    actionDialog.visible = false
    await reload()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    actionDialog.saving = false
  }
}

function executionRoute(plan: SalesPlan) {
  if (plan.planKind === 'opportunity_follow_up')
    return `/opportunities/${plan.opportunityId}?executePlan=${plan.id}`
  if (plan.planKind === 'complaint_follow_up')
    return `/complaints/${plan.complaintId}?executePlan=${plan.id}`
  return `/customers/${plan.customerId}?executePlan=${plan.id}`
}

function localInput(value: string): string {
  const date = new Date(value)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

const showDialog = ref(false)
const dialogDate = ref('')
const saving = ref(false)
const customerOptions = ref<CustomerItem[]>([])
const opportunityOptions = ref<Opportunity[]>([])
const recordOpportunityOptions = ref<Opportunity[]>([])
const planForm = reactive({
  planKind: 'customer_visit' as SalesPlanKind,
  customerId: '',
  opportunityId: '',
  plannedAt: '',
  content: '',
})

const recordDialog = reactive({
  visible: false,
  date: '',
  type: 'customer_visit' as 'customer_visit' | 'opportunity_follow_up' | 'opportunity_quote',
  customerId: '',
  opportunityId: '',
})

async function openRecordDialog(day: DayVM) {
  recordDialog.date = day.date
  recordDialog.type = 'customer_visit'
  recordDialog.customerId = ''
  recordDialog.opportunityId = ''
  if (!customerOptions.value.length) {
    const page = await listCustomers({ status: 'active', page: 1, pageSize: 50 })
    customerOptions.value = page.items
  }
  recordDialog.visible = true
}

async function loadRecordOpportunities() {
  recordDialog.opportunityId = ''
  if (!recordDialog.customerId) return
  const page = await listOpportunities({
    customerId: recordDialog.customerId,
    page: 1,
    pageSize: 50,
  })
  recordOpportunityOptions.value = page.items.filter(
    (item) => item.stage === 'intent' || item.stage === 'following',
  )
}

function continueRecord() {
  if (!recordDialog.customerId) return ElMessage.warning('请选择客户')
  if (recordDialog.type === 'customer_visit') {
    recordDialog.visible = false
    void router.push(`/customers/${recordDialog.customerId}?record=visit&date=${recordDialog.date}`)
    return
  }
  if (!recordDialog.opportunityId) return ElMessage.warning('请选择商机')
  recordDialog.visible = false
  const record = recordDialog.type === 'opportunity_quote' ? 'quote' : 'follow-up'
  void router.push(
    `/opportunities/${recordDialog.opportunityId}?record=${record}&date=${recordDialog.date}`,
  )
}

async function onBlankClick(day: DayVM) {
  dialogDate.value = day.date
  Object.assign(planForm, {
    planKind: 'customer_visit',
    customerId: '',
    opportunityId: '',
    plannedAt: `${day.date}T09:00`,
    content: '',
  })
  if (!customerOptions.value.length) {
    try {
      const page = await listCustomers({ status: 'active', page: 1, pageSize: 50 })
      customerOptions.value = page.items
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '客户选项加载失败')
      return
    }
  }
  showDialog.value = true
}

function onPlanKindChange() {
  planForm.opportunityId = ''
  opportunityOptions.value = []
}

async function loadOpportunityOptions() {
  planForm.opportunityId = ''
  if (planForm.planKind !== 'opportunity_follow_up' || !planForm.customerId) return
  const page = await listOpportunities({ customerId: planForm.customerId, page: 1, pageSize: 50 })
  opportunityOptions.value = page.items.filter(
    (item) => item.stage === 'intent' || item.stage === 'following',
  )
}

async function submitPlan() {
  if (!planForm.customerId || !planForm.plannedAt || !planForm.content.trim())
    return ElMessage.warning('请填写客户、时间和计划内容')
  if (planForm.planKind === 'opportunity_follow_up' && !planForm.opportunityId)
    return ElMessage.warning('请选择要跟进的商机')
  saving.value = true
  try {
    await createSalesPlan({
      planKind: planForm.planKind,
      customerId: planForm.customerId,
      opportunityId: planForm.opportunityId || undefined,
      plannedAt: new Date(planForm.plannedAt).toISOString(),
      content: planForm.content.trim(),
    })
    ElMessage.success('计划已安排')
    showDialog.value = false
    await reload()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '添加失败')
  } finally {
    saving.value = false
  }
}

function planLabel(kind: SalesPlanKind): string {
  return {
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机跟进',
    complaint_follow_up: '客诉处理',
  }[kind]
}
function recordLabel(type: WeekBusinessRecord['type']): string {
  return {
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机跟进',
    opportunity_quote: '报价记录',
  }[type]
}
function fmt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function timeOnly(value: string): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.week-view__overdue {
  margin-bottom: var(--crm-spacing-md);
}
.overdue-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.week-view__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: var(--crm-spacing-sm);
  min-height: 420px;
}
.week-view__col {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
}
.week-view__col--today {
  border-color: var(--crm-color-primary);
}
.week-view__col-head {
  display: flex;
  justify-content: space-between;
  padding: var(--crm-spacing-sm);
  border-bottom: 1px solid var(--crm-color-border);
  font-weight: 600;
}
.week-view__date--today {
  color: var(--crm-color-primary);
}
.week-view__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--crm-spacing-xs);
  padding: var(--crm-spacing-sm);
  overflow-y: auto;
}
.week-view__item {
  padding: 6px;
  border-radius: 4px;
  background: var(--crm-color-primary-light);
  font-size: var(--crm-font-size-sm);
  word-break: break-word;
}
.week-view__item--completed {
  filter: grayscale(1);
  opacity: 0.62;
  background: var(--crm-color-bg-page);
}
.week-view__item--cancelled {
  opacity: 0.45;
  background: var(--crm-color-bg-page);
  text-decoration: line-through;
}
.week-view__record {
  padding: 6px;
  border-left: 3px solid var(--crm-color-success);
  background: var(--crm-color-bg-page);
  font-size: var(--crm-font-size-sm);
}
.week-view__record--complaint {
  border-left-color: var(--crm-color-danger);
}
.week-view__section-title {
  margin-top: 4px;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
  font-weight: 600;
}
.week-view__empty,
.week-view__state {
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
.week-view__item-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  color: var(--crm-color-text-secondary);
}
.week-view__customer {
  display: block;
  margin-bottom: 2px;
}
.week-view__add {
  margin-top: auto;
  padding: var(--crm-spacing-sm);
  border-top: 1px dashed var(--crm-color-border);
  text-align: center;
  color: var(--crm-color-text-secondary);
  cursor: pointer;
  display: flex;
  justify-content: space-around;
}
</style>
