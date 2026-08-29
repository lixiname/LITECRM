<template>
  <div class="week-view">
    <AppPageHeader title="销售计划周视图" :description="weekLabel">
      <template #actions>
        <div class="week-view__navigator">
          <el-button-group>
            <el-button aria-label="上一周" @click="shiftWeek(-1)">‹</el-button>
            <el-date-picker
              v-model="weekPickerDate"
              type="week"
              format="YYYY年 第ww周"
              value-format="YYYY-MM-DD"
              :clearable="false"
              :editable="false"
              aria-label="选择所在周"
              class="week-view__week-picker"
            />
            <el-button aria-label="下一周" @click="shiftWeek(1)">›</el-button>
          </el-button-group>
          <el-button v-if="!isCurrentWeek" @click="goToday">回到本周</el-button>
        </div>
      </template>
    </AppPageHeader>

    <AppQueryState :error="error" @retry="reload" />

    <el-collapse v-if="!error && view?.overdue.length" class="week-view__overdue">
      <el-collapse-item name="overdue">
        <template #title>
          <span class="week-view__overdue-title">逾期待执行</span>
          <el-tag type="warning" effect="plain" size="small">{{ view.overdue.length }}</el-tag>
          <span class="week-view__overdue-hint">展开集中处理更早计划</span>
        </template>
        <div
          v-for="action in view.overdue"
          :key="action.id"
          class="overdue-row"
          role="button"
          tabindex="0"
          @click="handleActionCommand('execute', action)"
          @keydown.enter="handleActionCommand('execute', action)"
        >
          <span>
            {{ formatDateTime(action.plannedAt) }} · {{ planLabel(action.planKind) }} ·
            <strong>{{ action.customerName }}</strong> · {{ action.content }}
          </span>
          <div class="week-view__actions">
            <span>点击执行</span>
            <span @click.stop>
              <FollowUpActionMenu :action="action" hide-execute @command="handleActionCommand" />
            </span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>

    <el-card v-if="!error" v-loading="loading" class="week-view__card">
      <div class="week-view__scroll">
        <div class="week-view__grid">
          <div
            v-for="day in days"
            :key="day.date"
            class="week-view__col"
            :class="{ 'week-view__col--today': day.isToday }"
          >
            <div class="week-view__col-head">
              <div>
                <span>{{ day.weekday }}</span>
                <el-tag v-if="day.isToday" size="small" effect="plain">今天</el-tag>
              </div>
              <span :class="{ 'week-view__date--today': day.isToday }">{{ day.monthDay }}</span>
              <el-dropdown
                trigger="click"
                class="week-view__add-trigger"
                @command="(command: AddCommand) => handleAddCommand(command, day)"
              >
                <el-button type="primary" plain size="small">＋ 新增</el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item disabled>安排待办</el-dropdown-item>
                    <el-dropdown-item command="plan">客户拜访 / 商机推进计划</el-dropdown-item>
                    <el-dropdown-item disabled divided>记录已发生</el-dropdown-item>
                    <el-dropdown-item command="record">新商机 / 拜访 / 商机推进</el-dropdown-item>
                    <el-dropdown-item command="complaint" divided>登记新客诉</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>

            <div class="week-view__body">
              <section v-if="day.pendingPlans.length" class="week-view__section">
                <div class="week-view__section-head">
                  <span>待执行</span><small>{{ day.pendingPlans.length }}</small>
                </div>
                <div
                  v-for="action in day.pendingPlans"
                  :key="action.id"
                  class="week-view__item"
                  :class="{ 'week-view__item--overdue': isOverdue(action) }"
                  role="button"
                  tabindex="0"
                  @click="handleActionCommand('execute', action)"
                  @keydown.enter="handleActionCommand('execute', action)"
                >
                  <div class="week-view__item-head">
                    <span>{{ planLabel(action.planKind) }}</span>
                    <small>{{ isOverdue(action) ? '逾期' : '待办' }}</small>
                  </div>
                  <strong class="week-view__customer">{{ action.customerName }}</strong>
                  <small v-if="action.opportunityName">{{ action.opportunityName }}</small>
                  <div :title="action.content">{{ action.content }}</div>
                  <div class="week-view__item-actions">
                    <span>点击填报</span>
                    <span @click.stop>
                      <FollowUpActionMenu
                        :action="action"
                        hide-execute
                        @command="handleActionCommand"
                      />
                    </span>
                  </div>
                </div>
              </section>

              <section v-if="day.actualRecords.length" class="week-view__section">
                <div class="week-view__section-head">
                  <span>已发生</span><small>{{ day.actualRecords.length }}</small>
                </div>
                <div
                  v-for="record in day.actualRecords"
                  :key="`${record.type}-${record.id}`"
                  class="week-view__record"
                  :class="{ 'week-view__record--complaint': record.type.startsWith('complaint_') }"
                  role="button"
                  tabindex="0"
                  @click="openActualRecord(record)"
                  @keydown.enter="openActualRecord(record)"
                >
                  <div class="week-view__item-head">
                    <span>{{ recordLabel(record.type) }}</span
                    ><small>记录</small>
                  </div>
                  <strong class="week-view__customer">{{ record.customerName }}</strong>
                  <small v-if="record.opportunityName">{{ record.opportunityName }}</small>
                  <div>{{ record.summary }}</div>
                  <small class="week-view__source">
                    {{ record.sourcePlanId ? '来自计划' : '直接记录' }}
                  </small>
                </div>
              </section>

              <details v-if="day.closedPlans.length" class="week-view__closed">
                <summary>已结束计划 {{ day.closedPlans.length }}</summary>
                <div
                  v-for="action in day.closedPlans"
                  :key="action.id"
                  class="week-view__closed-item"
                  :class="{ 'week-view__closed-item--clickable': action.status === 'completed' }"
                  @click="openClosedPlan(action)"
                >
                  <span>{{ planLabel(action.planKind) }}</span>
                  <strong>{{ action.customerName }}</strong>
                  <small>{{
                    action.status === 'completed' ? '已执行' : action.cancelReason
                  }}</small>
                </div>
              </details>

              <div v-if="!day.hasContent" class="week-view__empty-state">
                <span>当天还没有安排或记录</span>
                <small>可安排待办，也可直接记录已经发生的业务</small>
              </div>
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
            <el-radio value="opportunity_follow_up">商机推进</el-radio>
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
        <el-form-item label="计划日期" required>
          <el-date-picker v-model="planForm.plannedAt" type="date" value-format="YYYY-MM-DD" />
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

    <el-dialog v-model="actionDialog.visible" title="计划改期" width="420px">
      <el-alert
        v-if="selectedAction"
        :title="`原计划：${formatDateTime(selectedAction.plannedAt)} · ${selectedAction.content}`"
        type="info"
        :closable="false"
        show-icon
      />
      <el-form label-width="80px">
        <el-form-item label="新日期" required>
          <el-date-picker
            v-model="actionDialog.plannedAt"
            type="date"
            value-format="YYYY-MM-DD"
            :disabled-date="disablePastDate"
          />
        </el-form-item>
        <el-form-item label="改期原因" required>
          <el-input
            v-model="actionDialog.reason"
            type="textarea"
            :rows="2"
            maxlength="150"
            show-word-limit
            placeholder="例如：客户临时调整时间"
          />
        </el-form-item>
      </el-form>
      <div v-if="actionDialog.historyLoading || actionDialog.history.length" class="plan-history">
        <div class="plan-history__title">计划调整历史</div>
        <div v-loading="actionDialog.historyLoading">
          <div v-for="item in actionDialog.history" :key="item.id" class="plan-history__item">
            <span
              >{{ formatDateTime(item.fromPlannedAt) }} →
              {{ formatDateTime(item.toPlannedAt) }}</span
            >
            <small
              >{{ item.reason }} · {{ item.changedByName }} ·
              {{ formatDateTime(item.occurredAt) }}</small
            >
            <small v-if="item.fromContent !== item.toContent">
              {{ item.fromContent || '未填写' }} → {{ item.toContent || '未填写' }}
            </small>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="actionDialog.visible = false">返回</el-button>
        <el-button type="primary" :loading="actionDialog.saving" @click="submitActionCommand">
          确认改期
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="recordDialog.visible" title="记录当日实际" width="520px">
      <el-form label-width="90px">
        <el-form-item label="记录类型" required>
          <el-radio-group v-model="recordDialog.type">
            <el-radio value="opportunity_created">新建商机</el-radio>
            <el-radio value="customer_visit">客户拜访</el-radio>
            <el-radio value="opportunity_follow_up">商机推进</el-radio>
            <el-radio value="complaint_registered">登记客诉</el-radio>
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
        <el-form-item v-if="recordDialog.type === 'opportunity_follow_up'" label="商机" required>
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

    <OpportunityCreateDialog ref="opportunityCreateDialog" @created="handleRecordChanged" />
    <CustomerBusinessDialogs
      v-if="dialogCustomerId"
      :key="dialogCustomerId"
      ref="customerBusinessDialogs"
      :customer-id="dialogCustomerId"
      :customer-name="dialogCustomerName"
      @changed="handleRecordChanged"
    />
    <OpportunityCommandDialogs
      v-if="dialogOpportunity"
      :key="dialogOpportunity.id"
      ref="opportunityCommands"
      :opportunity="dialogOpportunity"
      @changed="handleRecordChanged"
    />
    <ComplaintCommandDialog
      v-if="dialogComplaint"
      :key="dialogComplaint.id"
      ref="complaintCommands"
      :complaint="dialogComplaint"
      @changed="handleRecordChanged"
    />
    <ActualRecordDetailDrawer
      v-model="actualDetailVisible"
      :record="selectedActualRecord"
      :plan="selectedActualPlan"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import FollowUpActionMenu from '../components/actions/FollowUpActionMenu.vue'
import OpportunityCreateDialog from '../components/opportunities/OpportunityCreateDialog.vue'
import OpportunityCommandDialogs from '../components/opportunities/OpportunityCommandDialogs.vue'
import CustomerBusinessDialogs from '../components/customers/CustomerBusinessDialogs.vue'
import ComplaintCommandDialog from '../components/complaints/ComplaintCommandDialog.vue'
import ActualRecordDetailDrawer from '../components/planning/ActualRecordDetailDrawer.vue'
import {
  createSalesPlan,
  businessWeekRange,
  getComplaint,
  getOpportunity,
  getSalesPlanReschedules,
  getWeekView,
  isBusinessDate,
  listCustomers,
  listOpportunities,
  rescheduleSalesPlan,
  shiftBusinessDate,
  startOfBusinessWeek,
  useQuery,
  type CustomerItem,
  type ComplaintDetail,
  type Opportunity,
  type OpportunityDetail,
  type SalesPlan,
  type SalesPlanKind,
  type SalesPlanReschedule,
  type WeekBusinessRecord,
  type WeekComplaintRecord,
} from '@crm/domain'

type ActionCommand = 'execute' | 'reschedule'
type AddCommand = 'plan' | 'record' | 'complaint'
type ActualRecordVM = WeekBusinessRecord | WeekComplaintRecord
type ActualRecordType = ActualRecordVM['type']

const opportunityCreateDialog = ref<InstanceType<typeof OpportunityCreateDialog>>()
const route = useRoute()
const router = useRouter()
const customerBusinessDialogs = ref<InstanceType<typeof CustomerBusinessDialogs>>()
const opportunityCommands = ref<InstanceType<typeof OpportunityCommandDialogs>>()
const complaintCommands = ref<InstanceType<typeof ComplaintCommandDialog>>()
const dialogCustomerId = ref('')
const dialogCustomerName = ref('')
const dialogOpportunity = ref<OpportunityDetail>()
const dialogComplaint = ref<ComplaintDetail>()
const actualDetailVisible = ref(false)
const selectedActualRecord = ref<ActualRecordVM>()
const selectedActualPlan = ref<SalesPlan>()

const today = new Date()
const todayStr = fmt(today)
const currentWeekStart = startOfBusinessWeek(today)
const routeWeek = isBusinessDate(route.query.week) ? route.query.week : currentWeekStart
const weekStart = ref(startOfBusinessWeek(routeWeek))
const range = computed(() => businessWeekRange(weekStart.value))
const weekLabel = computed(() => {
  const start = new Date(`${range.value.monday}T00:00:00`)
  const end = new Date(`${range.value.sunday}T00:00:00`)
  const startText = `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日`
  const endText = `${end.getFullYear() === start.getFullYear() ? '' : `${end.getFullYear()}年`}${end.getMonth() + 1}月${end.getDate()}日`
  return `${startText}—${endText}`
})
const isCurrentWeek = computed(() => weekStart.value === currentWeekStart)
const weekPickerDate = computed({
  get: () => weekStart.value,
  set: (value: string | null) => {
    if (value) weekStart.value = startOfBusinessWeek(value)
  },
})

const {
  data: view,
  loading,
  error,
  reload,
} = useQuery('web-week-view', () => getWeekView(range.value.monday, range.value.sunday))
watch(weekStart, (value) => {
  void reload()
  if (route.query.week !== value) {
    void router.push({ query: { ...route.query, week: value } })
  }
})
watch(
  () => route.query.week,
  (value) => {
    if (!isBusinessDate(value)) return
    const normalized = startOfBusinessWeek(value)
    if (normalized !== weekStart.value) weekStart.value = normalized
  },
)

interface DayVM {
  date: string
  weekday: string
  monthDay: string
  isToday: boolean
  pendingPlans: SalesPlan[]
  closedPlans: SalesPlan[]
  actualRecords: ActualRecordVM[]
  hasContent: boolean
}

const days = computed<DayVM[]>(() => {
  const actionMap = new Map<string, SalesPlan[]>()
  const actualMap = new Map<string, ActualRecordVM[]>()
  for (const action of view.value?.plans ?? []) {
    const date = fmt(new Date(action.plannedAt))
    actionMap.set(date, [...(actionMap.get(date) ?? []), action])
  }
  for (const record of view.value?.businessRecords ?? []) {
    const date = fmt(new Date(record.occurredAt))
    actualMap.set(date, [...(actualMap.get(date) ?? []), record])
  }
  for (const record of view.value?.complaintRecords ?? []) {
    const date = fmt(new Date(record.occurredAt))
    actualMap.set(date, [...(actualMap.get(date) ?? []), record])
  }
  const result: DayVM[] = []
  for (let index = 0; index < 7; index++) {
    const dateValue = new Date(`${range.value.monday}T00:00:00`)
    dateValue.setDate(dateValue.getDate() + index)
    const date = fmt(dateValue)
    const plans = actionMap.get(date) ?? []
    const pendingPlans = plans.filter((item) => item.status === 'pending')
    const closedPlans = plans.filter((item) => item.status !== 'pending')
    const actualRecords = (actualMap.get(date) ?? []).sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    result.push({
      date,
      weekday: '周' + '一二三四五六日'[(dateValue.getDay() + 6) % 7],
      monthDay: `${dateValue.getMonth() + 1}/${dateValue.getDate()}`,
      isToday: date === todayStr,
      pendingPlans,
      closedPlans,
      actualRecords,
      hasContent: pendingPlans.length > 0 || closedPlans.length > 0 || actualRecords.length > 0,
    })
  }
  return result
})

function shiftWeek(offset: number) {
  weekStart.value = shiftBusinessDate(weekStart.value, offset * 7)
}
function goToday() {
  weekStart.value = currentWeekStart
}

function isOverdue(action: SalesPlan): boolean {
  return action.status === 'pending' && action.plannedAt.slice(0, 10) < todayStr
}

function disablePastDate(value: Date): boolean {
  return fmt(value) < todayStr
}

const selectedAction = ref<SalesPlan>()
const actionDialog = reactive({
  visible: false,
  plannedAt: '',
  reason: '',
  saving: false,
  historyLoading: false,
  history: [] as SalesPlanReschedule[],
})

function handleActionCommand(command: ActionCommand, action: SalesPlan) {
  if (command === 'execute') {
    void openPlanExecution(action)
    return
  }
  selectedAction.value = action
  actionDialog.plannedAt = localDateInput(action.plannedAt)
  actionDialog.reason = ''
  actionDialog.history = []
  actionDialog.visible = true
  actionDialog.historyLoading = true
  void getSalesPlanReschedules(action.id)
    .then((history) => {
      if (selectedAction.value?.id === action.id) actionDialog.history = history
    })
    .catch((error) => {
      ElMessage.error(error instanceof Error ? error.message : '改期历史加载失败')
    })
    .finally(() => {
      if (selectedAction.value?.id === action.id) actionDialog.historyLoading = false
    })
}

async function submitActionCommand() {
  const action = selectedAction.value
  if (!action) return
  if (!actionDialog.plannedAt) return ElMessage.warning('请选择新的计划日期')
  if (!actionDialog.reason.trim()) return ElMessage.warning('请填写改期原因')
  actionDialog.saving = true
  try {
    await rescheduleSalesPlan(
      action.id,
      action.version,
      toPlannedAt(actionDialog.plannedAt),
      actionDialog.reason.trim(),
    )
    ElMessage.success('计划已改期并保留记录')
    actionDialog.visible = false
    await reload()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    actionDialog.saving = false
  }
}

function localDateInput(value: string): string {
  return new Date(value).toLocaleDateString('sv-SE')
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
  type: 'customer_visit' as
    'opportunity_created' | 'customer_visit' | 'opportunity_follow_up' | 'complaint_registered',
  customerId: '',
  opportunityId: '',
})

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

async function continueRecord() {
  if (!recordDialog.customerId) return ElMessage.warning('请选择客户')
  if (recordDialog.type === 'opportunity_created') {
    const customer = customerOptions.value.find((item) => item.id === recordDialog.customerId)
    recordDialog.visible = false
    opportunityCreateDialog.value?.open({
      customerId: recordDialog.customerId,
      customerName: customer?.name,
      discoveredDate: recordDialog.date,
    })
    return
  }
  if (recordDialog.type === 'customer_visit' || recordDialog.type === 'complaint_registered') {
    recordDialog.visible = false
    const customer = customerOptions.value.find((item) => item.id === recordDialog.customerId)
    await prepareCustomerDialog(recordDialog.customerId, customer?.name ?? '')
    if (recordDialog.type === 'customer_visit') {
      customerBusinessDialogs.value?.openVisit(undefined, recordDialog.date)
    } else {
      customerBusinessDialogs.value?.openComplaint(recordDialog.date)
    }
    return
  }
  if (!recordDialog.opportunityId) return ElMessage.warning('请选择商机')
  recordDialog.visible = false
  await openOpportunityProgress(recordDialog.opportunityId, undefined, recordDialog.date)
}

function openActualRecord(record: ActualRecordVM) {
  selectedActualRecord.value = record
  selectedActualPlan.value = record.sourcePlanId
    ? view.value?.plans.find((item) => item.id === record.sourcePlanId)
    : undefined
  actualDetailVisible.value = true
}

function openClosedPlan(action: SalesPlan) {
  if (action.status !== 'completed') return
  const record = [
    ...(view.value?.businessRecords ?? []),
    ...(view.value?.complaintRecords ?? []),
  ].find((item) => item.sourcePlanId === action.id)
  if (!record) return ElMessage.warning('该计划的执行事实不在当前周视图范围内')
  selectedActualPlan.value = action
  selectedActualRecord.value = record
  actualDetailVisible.value = true
}

async function handleRecordChanged() {
  await reload()
}

async function openPlanExecution(plan: SalesPlan) {
  try {
    if (plan.planKind === 'customer_visit' && plan.customerId) {
      await prepareCustomerDialog(plan.customerId, plan.customerName ?? '')
      customerBusinessDialogs.value?.openVisit(plan)
      return
    }
    if (plan.planKind === 'opportunity_follow_up' && plan.opportunityId) {
      await openOpportunityProgress(plan.opportunityId, plan)
      return
    }
    if (plan.planKind === 'complaint_follow_up' && plan.complaintId) {
      dialogComplaint.value = await getComplaint(plan.complaintId)
      await nextTick()
      complaintCommands.value?.open(plan)
      return
    }
    ElMessage.error('计划缺少对应的业务对象，无法执行')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '业务表单加载失败')
  }
}

async function prepareCustomerDialog(customerId: string, customerName: string) {
  dialogCustomerId.value = customerId
  dialogCustomerName.value = customerName
  await nextTick()
}

async function openOpportunityProgress(
  opportunityId: string,
  plan?: SalesPlan,
  occurredDate?: string,
) {
  dialogOpportunity.value = await getOpportunity(opportunityId)
  await nextTick()
  opportunityCommands.value?.openProgress(plan, occurredDate)
}

function handleAddCommand(command: AddCommand, day: DayVM) {
  if (command === 'plan') {
    void onBlankClick(day)
    return
  }
  void openRecordDialog(day, command === 'complaint' ? 'complaint_registered' : undefined)
}

async function openRecordDialog(
  day: DayVM,
  initialType: typeof recordDialog.type = 'customer_visit',
) {
  recordDialog.date = day.date
  recordDialog.type = initialType
  recordDialog.customerId = ''
  recordDialog.opportunityId = ''
  if (!customerOptions.value.length) {
    const page = await listCustomers({ status: 'active', page: 1, pageSize: 50 })
    customerOptions.value = page.items
  }
  recordDialog.visible = true
}

async function onBlankClick(day: DayVM) {
  dialogDate.value = day.date
  Object.assign(planForm, {
    planKind: 'customer_visit',
    customerId: '',
    opportunityId: '',
    plannedAt: day.date,
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
    return ElMessage.warning('请填写客户、日期和计划内容')
  if (planForm.planKind === 'opportunity_follow_up' && !planForm.opportunityId)
    return ElMessage.warning('请选择要跟进的商机')
  saving.value = true
  try {
    await createSalesPlan({
      planKind: planForm.planKind,
      customerId: planForm.customerId,
      opportunityId: planForm.opportunityId || undefined,
      plannedAt: toPlannedAt(planForm.plannedAt),
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
    opportunity_follow_up: '商机推进',
    complaint_follow_up: '客诉处理',
  }[kind]
}
function recordLabel(type: ActualRecordType): string {
  return {
    opportunity_created: '发现商机',
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机推进',
    opportunity_quote: '独立报价',
    complaint_registered: '客诉登记',
    complaint_follow_up: '客诉跟进',
  }[type]
}
function fmt(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function toPlannedAt(value: string): string {
  return value
}
function formatDateTime(value: string): string {
  return value.length === 10 ? value : new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.week-view__navigator {
  display: flex;
  gap: var(--crm-spacing-sm);
  align-items: center;
}
.week-view__week-picker {
  width: 170px;
}
.week-view__overdue {
  margin-bottom: var(--crm-spacing-md);
  padding: 0 var(--crm-spacing-md);
  border: 1px solid var(--el-color-warning-light-5);
  border-radius: var(--crm-radius-md);
  background: var(--el-color-warning-light-9);
}
.week-view__overdue-title {
  margin-right: var(--crm-spacing-sm);
  font-weight: 600;
}
.week-view__overdue-hint {
  margin-left: var(--crm-spacing-sm);
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.overdue-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
  padding: var(--crm-spacing-sm) 0;
  border-top: 1px solid var(--el-color-warning-light-7);
  cursor: pointer;
}
.week-view__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: var(--crm-spacing-xs);
}
.week-view__card :deep(.el-card__body) {
  padding: var(--crm-spacing-md);
}
.week-view__scroll {
  padding-bottom: var(--crm-spacing-sm);
}
.week-view__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(268px, 1fr));
  gap: var(--crm-spacing-md);
  min-height: 420px;
}
.week-view__col {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-page);
  overflow: hidden;
}
.week-view__col--today {
  border-color: var(--crm-color-primary);
  box-shadow: 0 0 0 1px var(--crm-color-primary-light);
}
.week-view__col-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-sm);
  padding: var(--crm-spacing-md);
  border-bottom: 1px solid var(--crm-color-border);
  background: var(--crm-color-bg-card);
  font-weight: 600;
}
.week-view__col-head > div {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-xs);
}
.week-view__date--today {
  color: var(--crm-color-primary);
}
.week-view__body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: var(--crm-spacing-lg);
  padding: var(--crm-spacing-md);
}
.week-view__section {
  display: grid;
  gap: var(--crm-spacing-sm);
}
.week-view__section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
}
.week-view__item {
  padding: var(--crm-spacing-md);
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--crm-radius-md);
  background: var(--el-color-primary-light-9);
  font-size: var(--crm-font-size-sm);
  word-break: break-word;
  cursor: pointer;
}
.week-view__item--overdue {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}
.week-view__item--overdue .week-view__item-head small {
  color: var(--crm-color-danger);
  font-weight: 600;
}
.week-view__item-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--crm-spacing-sm);
  padding-top: var(--crm-spacing-sm);
  border-top: 1px solid var(--el-color-primary-light-7);
}
.week-view__record {
  padding: var(--crm-spacing-md);
  border-left: 3px solid var(--crm-color-success);
  border-radius: 0 var(--crm-radius-sm) var(--crm-radius-sm) 0;
  background: var(--crm-color-bg-card);
  font-size: var(--crm-font-size-sm);
  box-shadow: 0 1px 3px rgb(31 35 41 / 8%);
  cursor: pointer;
}
.week-view__record--complaint {
  border-left-color: var(--crm-color-danger);
}
.week-view__source {
  display: inline-block;
  margin-top: var(--crm-spacing-xs);
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.week-view__item-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  color: var(--crm-color-text-secondary);
}
.week-view__customer {
  display: block;
  margin-bottom: var(--crm-spacing-xs);
}
.week-view__closed {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.week-view__closed summary {
  cursor: pointer;
  user-select: none;
}
.week-view__closed-item {
  display: grid;
  gap: 2px;
  margin-top: var(--crm-spacing-sm);
  padding-left: var(--crm-spacing-sm);
  border-left: 2px solid var(--crm-color-border);
}
.week-view__closed-item--clickable {
  cursor: pointer;
}
.week-view__empty-state {
  display: flex;
  flex-direction: column;
  gap: var(--crm-spacing-xs);
  padding: var(--crm-spacing-xl) var(--crm-spacing-md);
  color: var(--crm-color-text-secondary);
  text-align: center;
}
.week-view__empty-state small {
  font-size: var(--crm-font-size-xs);
}
.week-view__add-trigger .el-button {
  white-space: nowrap;
}
.plan-history {
  margin-top: var(--crm-spacing-md);
  padding-top: var(--crm-spacing-md);
  border-top: 1px solid var(--crm-color-border);
}
.plan-history__title {
  margin-bottom: var(--crm-spacing-sm);
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
  font-weight: 600;
}
.plan-history__item {
  display: grid;
  gap: 2px;
  padding: var(--crm-spacing-sm) 0;
  font-size: var(--crm-font-size-sm);
}
.plan-history__item small {
  color: var(--crm-color-text-secondary);
}
</style>
