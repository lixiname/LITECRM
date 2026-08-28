<template>
  <div class="quick-add">
    <van-nav-bar title="快速记录当日事项" left-arrow @click-left="router.back()" />

    <!-- 日期快捷（§3.2 补录刚需） -->
    <div class="quick-add__date">
      <span class="quick-add__date-label">日期</span>
      <van-button
        size="small"
        :type="date === yesterday ? 'primary' : 'default'"
        @click="setDate(yesterday)"
        >昨天</van-button
      >
      <van-button
        size="small"
        :type="date === today ? 'primary' : 'default'"
        @click="setDate(today)"
        >今天</van-button
      >
      <van-button
        size="small"
        :type="date === tomorrow ? 'primary' : 'default'"
        @click="setDate(tomorrow)"
        >明天</van-button
      >
      <span class="quick-add__date-val">{{ date }}</span>
    </div>

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
        title="记录商机跟进"
        icon="chart-trending-o"
        is-link
        @click="pickType('opportunity_follow_up')"
      />
      <van-cell
        title="记录报价"
        icon="balance-list-o"
        is-link
        @click="pickType('opportunity_quote')"
      />
      <van-cell
        title="登记客诉"
        icon="warning-o"
        is-link
        @click="pickType('complaint_registered')"
      />
    </van-cell-group>

    <!-- 选类型后：选客户（预填日期） -->
    <template v-if="type">
      <div class="quick-add__pick">
        <van-search v-model="keyword" placeholder="搜索客户（名称/城市）" @search="load" />
        <van-cell-group inset>
          <van-cell
            v-for="c in customers"
            :key="c.id"
            :title="c.name"
            :label="c.city ?? ''"
            is-link
            @click="selectCustomer(c)"
          />
          <van-cell v-if="!loading && customers.length === 0" title="暂无客户" />
        </van-cell-group>
      </div>
    </template>

    <van-form v-if="selectedCustomer" class="quick-add__form">
      <van-cell-group inset :title="selectedCustomer.name">
        <van-field
          v-if="type === 'opportunity_follow_up' || type === 'opportunity_quote'"
          v-model="opportunityLabel"
          label="商机"
          readonly
          is-link
          placeholder="选择仍在推进的商机"
          @click="showOpportunityPicker = true"
        />
      </van-cell-group>
      <div class="quick-add__submit">
        <van-button block round type="primary" :loading="saving" @click="continueAction">
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
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { listCustomers, listOpportunities, type CustomerItem, type Opportunity } from '@crm/domain'

type QuickRecordType =
  | 'opportunity_created'
  | 'customer_visit'
  | 'opportunity_follow_up'
  | 'opportunity_quote'
  | 'complaint_registered'

const route = useRoute()
const router = useRouter()

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const today = fmt(new Date())
const yesterday = fmt(new Date(Date.now() - 86400000))
const tomorrow = fmt(new Date(Date.now() + 86400000))

// 日期：优先路由 query（周览传入），默认今天
const date = ref<string>((route.query.date as string) || today)
const type = ref<QuickRecordType | null>(null)
const keyword = ref('')
const customers = ref<CustomerItem[]>([])
const loading = ref(false)
const selectedCustomer = ref<CustomerItem>()
const opportunities = ref<Opportunity[]>([])
const opportunityId = ref('')
const saving = ref(false)
const showOpportunityPicker = ref(false)
const opportunityColumns = computed(() =>
  opportunities.value.map((item) => ({ text: item.name, value: item.id })),
)
const opportunityLabel = computed(
  () => opportunities.value.find((item) => item.id === opportunityId.value)?.name ?? '',
)

function setDate(d: string) {
  date.value = d
  // 保持快速录入日期基准；具体表单可在目标页面里再确认时间
}
function pickType(t: QuickRecordType) {
  type.value = t
  selectedCustomer.value = undefined
  opportunityId.value = ''
  void load()
}
async function load() {
  loading.value = true
  try {
    const page = await listCustomers({ page: 1, pageSize: 20, keyword: keyword.value.trim() })
    customers.value = page.items
  } finally {
    loading.value = false
  }
}

async function selectCustomer(customer: CustomerItem) {
  selectedCustomer.value = customer
  opportunityId.value = ''
  if (type.value === 'opportunity_follow_up' || type.value === 'opportunity_quote') {
    const page = await listOpportunities({ customerId: customer.id, page: 1, pageSize: 50 })
    opportunities.value = page.items.filter(
      (item) => item.stage === 'intent' || item.stage === 'following',
    )
  }
}

function pickOpportunity({ selectedOptions }: { selectedOptions: { value: string }[] }) {
  opportunityId.value = selectedOptions[0].value
  showOpportunityPicker.value = false
}

async function continueAction() {
  if (!type.value || !selectedCustomer.value) return
  if (
    (type.value === 'opportunity_follow_up' || type.value === 'opportunity_quote') &&
    !opportunityId.value
  ) {
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
          mode: type.value === 'opportunity_quote' ? 'quote' : 'follow_up',
        },
      })
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '跳转失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.quick-add {
  box-sizing: border-box;
  min-height: 100vh;
  padding-bottom: 88px;
}
.quick-add__form,
.quick-add__submit {
  margin-top: var(--crm-spacing-md);
}
.quick-add__submit {
  padding: 0 var(--crm-spacing-md);
}
</style>
