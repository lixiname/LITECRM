<template>
  <van-popup
    :show="modelValue"
    position="bottom"
    round
    closeable
    class="plan-create-sheet"
    @update:show="emit('update:modelValue', $event)"
  >
    <div class="plan-create-sheet__content">
      <h3>新增计划</h3>
      <van-cell-group inset title="计划类型">
        <van-radio-group v-model="form.planKind" direction="horizontal" @change="resetOpportunity">
          <van-radio name="customer_visit">客户拜访</van-radio>
          <van-radio name="opportunity_follow_up">商机推进</van-radio>
        </van-radio-group>
      </van-cell-group>

      <van-cell-group inset title="业务对象" class="plan-create-sheet__section">
        <van-cell
          v-if="selectedCustomer"
          title="客户"
          :value="selectedCustomer.name"
          is-link
          @click="clearCustomer"
        />
        <template v-else>
          <van-search
            v-model="keyword"
            placeholder="输入客户名称或城市"
            @update:model-value="scheduleSearch"
            @search="searchNow"
          />
          <div v-if="loading" class="plan-create-sheet__loading">
            <van-loading size="20">正在检索客户</van-loading>
          </div>
          <van-cell
            v-for="customer in customers"
            :key="customer.id"
            :title="customer.name"
            :label="[customer.city, `${customer.grade}级`].filter(Boolean).join(' · ')"
            is-link
            @click="selectCustomer(customer)"
          />
        </template>
        <van-field
          v-if="form.planKind === 'opportunity_follow_up' && selectedCustomer"
          v-model="opportunityLabel"
          label="商机"
          readonly
          is-link
          required
          placeholder="选择仍在推进的商机"
          @click="showOpportunityPicker = true"
        />
      </van-cell-group>

      <van-cell-group inset title="安排" class="plan-create-sheet__section">
        <van-field
          v-model="form.plannedAt"
          label="计划日期"
          readonly
          is-link
          required
          @click="showCalendar = true"
        />
        <van-field
          v-model="form.content"
          label="计划内容"
          type="textarea"
          rows="2"
          maxlength="150"
          show-word-limit
          required
          placeholder="写给自己看的下一步安排"
        />
      </van-cell-group>

      <div class="plan-create-sheet__actions">
        <van-button block round @click="emit('update:modelValue', false)">取消</van-button>
        <van-button block round type="primary" :loading="saving" @click="submit">
          保存计划
        </van-button>
      </div>
    </div>
  </van-popup>

  <van-popup v-model:show="showOpportunityPicker" position="bottom" round>
    <van-picker
      :columns="opportunityColumns"
      @confirm="pickOpportunity"
      @cancel="showOpportunityPicker = false"
    />
  </van-popup>
  <van-calendar
    v-model:show="showCalendar"
    title="选择计划日期"
    :show-confirm="false"
    :default-date="new Date(`${form.plannedAt}T00:00:00`)"
    :min-date="todayDate"
    :max-date="maxDate"
    @confirm="pickDate"
  />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { showToast } from 'vant'
import {
  createSalesPlan,
  listCustomers,
  listOpportunities,
  type CustomerItem,
  type Opportunity,
  type SalesPlanKind,
} from '@crm/domain'
import { localDate } from '../../libs/sales-workbench'

const props = defineProps<{ modelValue: boolean; initialDate: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean]; saved: [] }>()
const today = localDate(new Date())
const todayDate = new Date(`${today}T00:00:00`)
const maxDate = new Date(todayDate.getFullYear() + 2, 11, 31)
const form = reactive({
  planKind: 'customer_visit' as Extract<SalesPlanKind, 'customer_visit' | 'opportunity_follow_up'>,
  plannedAt: today,
  content: '',
  opportunityId: '',
})
const selectedCustomer = ref<CustomerItem>()
const keyword = ref('')
const customers = ref<CustomerItem[]>([])
const opportunities = ref<Opportunity[]>([])
const loading = ref(false)
const saving = ref(false)
const showOpportunityPicker = ref(false)
const showCalendar = ref(false)
let searchTimer: ReturnType<typeof setTimeout> | undefined
let searchRevision = 0

const opportunityColumns = computed(() =>
  opportunities.value.map((item) => ({ text: item.name, value: item.id })),
)
const opportunityLabel = computed(
  () => opportunities.value.find((item) => item.id === form.opportunityId)?.name ?? '',
)

watch(
  () => props.modelValue,
  (visible) => {
    if (!visible) return
    form.planKind = 'customer_visit'
    form.plannedAt = props.initialDate < today ? today : props.initialDate
    form.content = ''
    form.opportunityId = ''
    selectedCustomer.value = undefined
    opportunities.value = []
    keyword.value = ''
    customers.value = []
    void loadCustomers('')
  },
)

function scheduleSearch(value: string) {
  clearTimeout(searchTimer)
  const revision = ++searchRevision
  loading.value = true
  searchTimer = setTimeout(() => void loadCustomers(value, revision), 300)
}
function searchNow() {
  clearTimeout(searchTimer)
  void loadCustomers(keyword.value, ++searchRevision)
}
async function loadCustomers(keywordValue: string, revision = ++searchRevision) {
  loading.value = true
  try {
    const page = await listCustomers({
      status: 'active',
      keyword: keywordValue.trim(),
      page: 1,
      pageSize: 20,
    })
    if (revision === searchRevision) customers.value = page.items
  } catch (error) {
    if (revision === searchRevision) {
      customers.value = []
      showToast(error instanceof Error ? error.message : '客户检索失败')
    }
  } finally {
    if (revision === searchRevision) loading.value = false
  }
}
async function selectCustomer(customer: CustomerItem) {
  selectedCustomer.value = customer
  form.opportunityId = ''
  if (form.planKind !== 'opportunity_follow_up') return
  const page = await listOpportunities({ customerId: customer.id, page: 1, pageSize: 50 })
  opportunities.value = page.items.filter(
    (item) => item.stage === 'intent' || item.stage === 'following',
  )
}
function clearCustomer() {
  selectedCustomer.value = undefined
  form.opportunityId = ''
  opportunities.value = []
  keyword.value = ''
  customers.value = []
  void loadCustomers('')
}
async function resetOpportunity() {
  form.opportunityId = ''
  opportunities.value = []
  if (form.planKind === 'opportunity_follow_up' && selectedCustomer.value) {
    await selectCustomer(selectedCustomer.value)
  }
}
function pickOpportunity({ selectedOptions }: { selectedOptions: { value: string }[] }) {
  form.opportunityId = selectedOptions[0].value
  showOpportunityPicker.value = false
}
function pickDate(value: Date | Date[]) {
  form.plannedAt = localDate(Array.isArray(value) ? value[0] : value)
  showCalendar.value = false
}
async function submit() {
  if (!selectedCustomer.value) return showToast('请选择客户')
  if (form.planKind === 'opportunity_follow_up' && !form.opportunityId) {
    return showToast('请选择要推进的商机')
  }
  if (!form.content.trim()) return showToast('请填写计划内容')
  saving.value = true
  try {
    await createSalesPlan({
      planKind: form.planKind,
      plannedAt: form.plannedAt,
      content: form.content.trim(),
      customerId: selectedCustomer.value.id,
      opportunityId: form.opportunityId || undefined,
    })
    showToast('计划已安排')
    emit('update:modelValue', false)
    emit('saved')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '计划保存失败')
  } finally {
    saving.value = false
  }
}

onBeforeUnmount(() => {
  clearTimeout(searchTimer)
  searchRevision += 1
})
</script>

<style scoped>
.plan-create-sheet {
  max-height: 90vh;
}
.plan-create-sheet__content {
  max-height: 90vh;
  padding: var(--crm-spacing-lg) 0;
  overflow-y: auto;
}
.plan-create-sheet h3 {
  margin: 0 0 var(--crm-spacing-md);
  text-align: center;
}
.plan-create-sheet__section {
  margin-top: var(--crm-spacing-md);
}
.plan-create-sheet__content :deep(.van-radio-group) {
  gap: var(--crm-spacing-xl);
  padding: var(--crm-spacing-md);
}
.plan-create-sheet__loading {
  display: flex;
  justify-content: center;
  padding: var(--crm-spacing-lg);
}
.plan-create-sheet__actions {
  display: grid;
  grid-template-columns: 1fr 1.35fr;
  gap: var(--crm-spacing-sm);
  padding: var(--crm-spacing-xl) var(--crm-spacing-md) 0;
}
</style>
