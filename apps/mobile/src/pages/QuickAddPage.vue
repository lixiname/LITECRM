<template>
  <div class="quick-add">
    <van-nav-bar
      :title="mode === 'plan' ? '安排销售计划' : '记录当日实际'"
      left-arrow
      @click-left="router.back()"
    />

    <van-tabs v-model:active="mode">
      <van-tab title="安排计划" name="plan" />
      <van-tab title="记录实际" name="record" />
    </van-tabs>

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

    <!-- 类型面板（§4.1 超兔式：意图直接） -->
    <van-cell-group inset :title="mode === 'plan' ? '计划做什么' : '实际做了什么'">
      <van-cell
        :title="mode === 'plan' ? '安排客户拜访' : '记录客户拜访'"
        icon="guide-o"
        is-link
        @click="pickType('customer_visit')"
      />
      <van-cell
        :title="mode === 'plan' ? '安排商机跟进' : '记录商机跟进'"
        icon="chart-trending-o"
        is-link
        @click="pickType('opportunity_follow_up')"
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

    <van-form v-if="selectedCustomer" class="quick-add__form" @submit="continueAction">
      <van-cell-group inset :title="selectedCustomer.name">
        <van-field
          v-if="type === 'opportunity_follow_up'"
          v-model="opportunityLabel"
          label="商机"
          readonly
          is-link
          placeholder="选择仍在推进的商机"
          @click="showOpportunityPicker = true"
        />
        <van-field
          v-if="mode === 'plan'"
          v-model="plannedAt"
          label="计划时间"
          type="datetime-local"
          required
        />
        <van-field
          v-if="mode === 'plan'"
          v-model="content"
          label="计划内容"
          type="textarea"
          rows="2"
          required
          placeholder="写给自己看的下一步安排"
        />
      </van-cell-group>
      <div class="quick-add__submit">
        <van-button block round type="primary" native-type="submit" :loading="saving">{{
          mode === 'plan' ? '保存计划' : '继续填写实际情况'
        }}</van-button>
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
import {
  createSalesPlan,
  listCustomers,
  listOpportunities,
  type CustomerItem,
  type Opportunity,
  type SalesPlanKind,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()

const fmt = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const today = fmt(new Date())
const yesterday = fmt(new Date(Date.now() - 86400000))
const tomorrow = fmt(new Date(Date.now() + 86400000))

// 日期：优先路由 query（周览空 card 传入），默认今天
const date = ref<string>((route.query.date as string) || today)
const mode = ref<'plan' | 'record'>((route.query.mode as 'plan' | 'record') || 'plan')
const type = ref<SalesPlanKind | null>(null)
const keyword = ref('')
const customers = ref<CustomerItem[]>([])
const loading = ref(false)
const selectedCustomer = ref<CustomerItem>()
const opportunities = ref<Opportunity[]>([])
const opportunityId = ref('')
const plannedAt = ref(`${date.value}T09:00`)
const content = ref('')
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
  plannedAt.value = `${d}T09:00`
}
function pickType(t: SalesPlanKind) {
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
  if (type.value === 'opportunity_follow_up') {
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
  if (type.value === 'opportunity_follow_up' && !opportunityId.value)
    return showToast('请选择要跟进的商机')
  if (mode.value === 'record') {
    if (type.value === 'customer_visit') {
      await router.push({
        path: `/customers/${selectedCustomer.value.id}/visit/new`,
        query: { date: date.value },
      })
    } else {
      await router.push({
        path: `/opportunities/${opportunityId.value}/follow-up`,
        query: { date: date.value },
      })
    }
    return
  }
  if (!plannedAt.value || !content.value.trim()) return showToast('请填写计划时间和内容')
  saving.value = true
  try {
    await createSalesPlan({
      planKind: type.value,
      customerId: selectedCustomer.value.id,
      opportunityId: opportunityId.value || undefined,
      plannedAt: new Date(plannedAt.value).toISOString(),
      content: content.value.trim(),
    })
    showToast('计划已安排')
    router.back()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.quick-add__form,
.quick-add__submit {
  margin-top: var(--crm-spacing-md);
}
.quick-add__submit {
  padding: 0 var(--crm-spacing-md);
}
</style>
