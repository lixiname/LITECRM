<template>
  <div class="quick-add">
    <van-nav-bar
      :title="pageTitle"
      :left-arrow="fromWeek"
      @click-left="fromWeek && router.back()"
    />

    <van-cell-group
      inset
      :title="fromWeek && date < today ? `正在补录 ${displayDate(date)} 的业务实际` : '本次记录'"
      class="quick-add__date"
    >
      <van-cell
        title="发生日期"
        :value="date === today ? `今天 · ${displayDate(date)}` : displayDate(date)"
        is-link
        @click="showDateCalendar = true"
      />
    </van-cell-group>

    <van-cell-group v-if="dayPlans.length" inset title="优先处理已有计划" class="quick-add__plans">
      <van-cell
        v-for="planItem in dayPlans"
        :key="planItem.id"
        :title="`${planLabel(planItem)} · ${planItem.customerName ?? '客户'}`"
        :label="`${formatTime(planItem.plannedAt)} · ${planItem.content}`"
        is-link
        @click="router.push(salesPlanExecutionRoute(planItem))"
      />
    </van-cell-group>

    <!-- 类型面板（移动端聚焦实际） -->
    <van-cell-group inset title="新增或记录">
      <van-cell
        title="新建商机"
        icon="add-square"
        is-link
        @click="pickType('opportunity_created')"
      />
      <van-cell title="记录客户拜访" icon="guide-o" is-link @click="pickType('customer_visit')" />
      <van-cell
        title="记录商机推进"
        icon="chart-trending-o"
        is-link
        @click="pickType('opportunity_follow_up')"
      />
      <van-cell
        title="登记客诉"
        icon="warning-o"
        is-link
        @click="pickType('complaint_registered')"
      />
    </van-cell-group>

    <!-- 选类型后：选客户（预填日期） -->
    <template v-if="type && !selectedCustomer">
      <div class="quick-add__pick">
        <van-search
          v-model="keyword"
          placeholder="输入客户名称或城市"
          @update:model-value="scheduleCustomerSearch"
          @search="searchCustomersNow"
        />
        <van-cell-group inset>
          <div v-if="loading" class="quick-add__customer-loading">
            <van-loading size="20">正在检索客户</van-loading>
          </div>
          <van-cell
            v-for="c in customers"
            :key="c.id"
            :title="c.name"
            :label="customerMeta(c)"
            is-link
            @click="selectCustomer(c)"
          />
          <van-cell
            v-if="!loading && customers.length === 0"
            title="没有匹配的客户"
            label="请尝试输入更完整的客户名称或城市"
          />
        </van-cell-group>
      </div>
    </template>

    <van-form v-if="selectedCustomer" class="quick-add__form">
      <van-cell-group inset title="已选业务对象">
        <van-cell title="客户" :value="selectedCustomer.name" is-link @click="changeCustomer" />
        <van-field
          v-if="type === 'opportunity_follow_up'"
          v-model="opportunityLabel"
          label="商机"
          readonly
          is-link
          placeholder="选择仍在推进的商机"
          @click="showOpportunityPicker = true"
        />
      </van-cell-group>
      <van-cell-group v-if="matchingPlan" inset title="已存在相关计划" class="quick-add__match">
        <van-cell
          :title="planLabel(matchingPlan)"
          :label="`${formatTime(matchingPlan.plannedAt)} · ${matchingPlan.content}`"
        />
        <div class="quick-add__match-actions">
          <van-button block round type="primary" @click="executeMatchingPlan">
            {{ matchingPlanCta }}
          </van-button>
          <van-button block plain round @click="recordOutsidePlan = true">
            记录计划外实际
          </van-button>
        </div>
      </van-cell-group>
      <div class="quick-add__submit">
        <van-button
          v-if="!matchingPlan || recordOutsidePlan"
          block
          round
          type="primary"
          :loading="saving"
          @click="continueAction"
        >
          继续填写
        </van-button>
      </div>
    </van-form>

    <van-popup v-model:show="showOpportunityPicker" position="bottom" round>
      <van-picker
        :columns="opportunityColumns"
        @confirm="pickOpportunity"
        @cancel="showOpportunityPicker = false"
      />
    </van-popup>

    <van-calendar
      v-model:show="showDateCalendar"
      title="选择实际发生日期"
      :show-confirm="false"
      :default-date="new Date(`${date}T00:00:00`)"
      :min-date="calendarMinDate"
      :max-date="todayDate"
      @confirm="selectOccurredDate"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  getCustomer,
  getOpportunity,
  getWeekView,
  isBusinessDate,
  listCustomers,
  listOpportunities,
  type CustomerItem,
  type Opportunity,
  type SalesPlan,
} from '@crm/domain'
import { salesPlanExecutionRoute } from '@/libs/sales-workbench'

type QuickRecordType =
  'opportunity_created' | 'customer_visit' | 'opportunity_follow_up' | 'complaint_registered'

const route = useRoute()
const router = useRouter()

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const today = fmt(new Date())
const todayDate = new Date(`${today}T00:00:00`)
const calendarMinDate = new Date(todayDate.getFullYear() - 2, 0, 1)
const fromWeek = route.query.source === 'week'

// 实际发生日期：直接进入默认今天；周视图“记录当日实际”明确携带所选日期。
const requestedDate = isBusinessDate(route.query.date) ? route.query.date : today
const date = ref<string>(requestedDate > today ? today : requestedDate)
const type = ref<QuickRecordType | null>(null)
const keyword = ref('')
const customers = ref<CustomerItem[]>([])
const loading = ref(false)
const selectedCustomer = ref<CustomerItem>()
const opportunities = ref<Opportunity[]>([])
const opportunityId = ref('')
const saving = ref(false)
const showOpportunityPicker = ref(false)
const showDateCalendar = ref(false)
const dayPlans = ref<SalesPlan[]>([])
const matchingPlan = ref<SalesPlan>()
const recordOutsidePlan = ref(false)
let customerSearchTimer: ReturnType<typeof setTimeout> | undefined
let customerSearchRevision = 0
const opportunityColumns = computed(() =>
  opportunities.value.map((item) => ({ text: item.name, value: item.id })),
)
const opportunityLabel = computed(
  () => opportunities.value.find((item) => item.id === opportunityId.value)?.name ?? '',
)
const matchingPlanCta = computed(() => {
  if (!matchingPlan.value) return '按此计划填报'
  return matchingPlan.value.plannedAt.slice(0, 10) > date.value ? '提前执行此计划' : '按此计划填报'
})
const pageTitle = computed(() => (fromWeek && date.value < today ? '补录当日实际' : '快速记录'))

onMounted(loadPlans)

function selectOccurredDate(value: Date | Date[]) {
  const selected = Array.isArray(value) ? value[0] : value
  date.value = fmt(selected)
  showDateCalendar.value = false
  void loadPlans()
}
function pickType(t: QuickRecordType) {
  type.value = t
  keyword.value = ''
  customers.value = []
  selectedCustomer.value = undefined
  opportunityId.value = ''
  matchingPlan.value = undefined
  recordOutsidePlan.value = false
  void loadCustomers('')
}

function scheduleCustomerSearch(value: string) {
  clearTimeout(customerSearchTimer)
  const revision = ++customerSearchRevision
  loading.value = true
  customerSearchTimer = setTimeout(() => void loadCustomers(value, revision), 300)
}

function searchCustomersNow() {
  clearTimeout(customerSearchTimer)
  const revision = ++customerSearchRevision
  void loadCustomers(keyword.value, revision)
}

async function loadCustomers(keywordValue: string, revision = ++customerSearchRevision) {
  loading.value = true
  try {
    const page = await listCustomers({
      status: 'active',
      page: 1,
      pageSize: 20,
      keyword: keywordValue.trim(),
    })
    if (revision !== customerSearchRevision) return
    customers.value = page.items
  } catch (error) {
    if (revision === customerSearchRevision) {
      customers.value = []
      showToast(error instanceof Error ? error.message : '客户检索失败')
    }
  } finally {
    if (revision === customerSearchRevision) loading.value = false
  }
}

function customerMeta(customer: CustomerItem): string {
  return [customer.city, customer.grade ? `${customer.grade}级` : ''].filter(Boolean).join(' · ')
}

function changeCustomer() {
  selectedCustomer.value = undefined
  opportunities.value = []
  opportunityId.value = ''
  matchingPlan.value = undefined
  recordOutsidePlan.value = false
  keyword.value = ''
  customers.value = []
  void loadCustomers('')
}

async function selectCustomer(customer: CustomerItem) {
  selectedCustomer.value = customer
  opportunityId.value = ''
  matchingPlan.value = undefined
  recordOutsidePlan.value = false
  if (type.value === 'opportunity_follow_up') {
    const page = await listOpportunities({ customerId: customer.id, page: 1, pageSize: 50 })
    opportunities.value = page.items.filter(
      (item) => item.stage === 'intent' || item.stage === 'following',
    )
  } else if (type.value === 'customer_visit') {
    const detail = await getCustomer(customer.id)
    matchingPlan.value = detail.currentVisitPlan ?? undefined
  }
}

async function pickOpportunity({ selectedOptions }: { selectedOptions: { value: string }[] }) {
  opportunityId.value = selectedOptions[0].value
  showOpportunityPicker.value = false
  const detail = await getOpportunity(opportunityId.value)
  matchingPlan.value = detail.actions[0]
  recordOutsidePlan.value = false
}

async function loadPlans() {
  try {
    const view = await getWeekView(date.value, date.value)
    const unique = new Map<string, SalesPlan>()
    const candidates = date.value === today ? [...view.overdue, ...view.plans] : view.plans
    for (const item of candidates) {
      if (item.status === 'pending') unique.set(item.id, item)
    }
    dayPlans.value = [...unique.values()].sort(
      (left, right) => new Date(left.plannedAt).getTime() - new Date(right.plannedAt).getTime(),
    )
  } catch (error) {
    showToast(error instanceof Error ? error.message : '计划加载失败')
  }
}

function executeMatchingPlan() {
  if (matchingPlan.value) void router.push(salesPlanExecutionRoute(matchingPlan.value))
}

async function continueAction() {
  if (!type.value || !selectedCustomer.value) return
  if (type.value === 'opportunity_follow_up' && !opportunityId.value) {
    return showToast('请选择要跟进的商机')
  }
  saving.value = true
  try {
    if (type.value === 'opportunity_created') {
      await router.push({
        path: `/customers/${selectedCustomer.value.id}/opportunity/new`,
        query: { date: date.value },
      })
    } else if (type.value === 'customer_visit') {
      await router.push({
        path: `/customers/${selectedCustomer.value.id}/visit/new`,
        query: { date: date.value },
      })
    } else if (type.value === 'complaint_registered') {
      await router.push({
        path: `/customers/${selectedCustomer.value.id}/complaint/new`,
        query: { date: date.value },
      })
    } else {
      await router.push({
        path: `/opportunities/${opportunityId.value}/follow-up`,
        query: {
          date: date.value,
        },
      })
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '跳转失败')
  } finally {
    saving.value = false
  }
}

function planLabel(planItem: SalesPlan): string {
  if (planItem.planKind === 'customer_visit') return '客户拜访'
  if (planItem.planKind === 'complaint_follow_up') return '客诉跟进'
  return '商机推进'
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

function displayDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00`)
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日`
}

onBeforeUnmount(() => {
  clearTimeout(customerSearchTimer)
  customerSearchRevision += 1
})
</script>

<style scoped>
.quick-add {
  box-sizing: border-box;
  min-height: 100vh;
  padding-bottom: 88px;
  background: var(--crm-color-bg-page);
}
.quick-add__form,
.quick-add__submit,
.quick-add__date,
.quick-add__plans,
.quick-add__match {
  margin-top: var(--crm-spacing-md);
}
.quick-add__submit {
  padding: 0 var(--crm-spacing-md);
}
.quick-add__match-actions {
  display: grid;
  gap: var(--crm-spacing-sm);
  padding: var(--crm-spacing-md);
}
.quick-add__customer-loading {
  display: flex;
  justify-content: center;
  padding: var(--crm-spacing-lg);
}
.quick-add :deep(.van-cell-group__title) {
  padding-top: var(--crm-spacing-lg);
  color: var(--crm-color-text-secondary);
  font-size: 11px;
  font-weight: 680;
  letter-spacing: 0.04em;
}
.quick-add :deep(.van-cell__left-icon) {
  color: var(--crm-color-primary);
}
</style>
