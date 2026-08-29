<template>
  <div class="mine">
    <van-nav-bar title="我的" />

    <van-loading v-if="loading" class="mine__loading" />
    <van-empty v-else-if="error" :description="error">
      <van-button size="small" type="primary" @click="reload">重新加载</van-button>
    </van-empty>
    <template v-else>
      <section class="mine__summary">
        <button type="button" @click="router.push('/')">
          <strong :class="{ 'is-danger': overdue.length > 0 }">{{ overdue.length }}</strong>
          <span>逾期待执行</span>
        </button>
        <button type="button" @click="router.push('/')">
          <strong>{{ todayPending.length }}</strong
          ><span>今日待执行</span>
        </button>
        <button type="button" @click="router.push('/')">
          <strong>{{ completedCount }}</strong
          ><span>本周已执行</span>
        </button>
        <button type="button" @click="router.push('/')">
          <strong>{{ actualCount }}</strong
          ><span>本周已发生</span>
        </button>
      </section>

      <MyPipelineSummaryCard />

      <van-cell-group v-if="overdue.length" inset title="需先处理的逾期计划">
        <van-cell
          v-for="plan in overdue.slice(0, 5)"
          :key="plan.id"
          :title="plan.customerName"
          :value="planLabel(plan.planKind)"
          :label="`${dateTime(plan.plannedAt)} · ${plan.content}`"
          :is-link="canWrite"
          @click="canWrite && execute(plan)"
        />
      </van-cell-group>

      <van-cell-group inset title="今日待执行">
        <van-cell
          v-for="plan in todayPending"
          :key="plan.id"
          :title="plan.customerName"
          :value="planLabel(plan.planKind)"
          :label="plan.content"
          :is-link="canWrite"
          @click="canWrite && execute(plan)"
        />
        <van-empty v-if="!todayPending.length" description="今日暂无待执行计划" :image-size="54" />
      </van-cell-group>
    </template>

    <van-cell-group inset title="当前用户" class="mine__profile">
      <van-cell title="姓名" :value="auth.user?.displayName" />
      <van-cell title="账号" :value="auth.user?.username" />
      <van-cell title="角色" :value="ROLE_LABELS[auth.user?.role ?? 'sales']" />
      <van-cell title="数据范围" :value="DATA_SCOPE_LABELS[auth.dataScope ?? 'self']" />
    </van-cell-group>

    <van-cell-group v-if="canWrite" inset title="业务工具" class="mine__tools">
      <van-cell
        title="费用管理"
        label="记录并查看本月销售费用"
        icon="balance-list-o"
        is-link
        to="/expenses"
      />
    </van-cell-group>

    <div class="mine__logout">
      <van-button round block type="danger" plain @click="handleLogout">退出登录</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  DATA_SCOPE_LABELS,
  getWeekView,
  ROLE_LABELS,
  useAuthStore,
  useQuery,
  type SalesPlan,
  type SalesPlanKind,
} from '@crm/domain'
import { localDate, salesPlanExecutionRoute } from '../libs/sales-workbench'
import MyPipelineSummaryCard from '../components/MyPipelineSummaryCard.vue'

const router = useRouter()
const auth = useAuthStore()
const canWrite = computed(() => auth.hasAbility('customer.write'))
const now = new Date()
const today = localDate(now)
const monday = new Date(now)
const weekday = monday.getDay() || 7
monday.setDate(monday.getDate() - weekday + 1)
const sunday = new Date(monday)
sunday.setDate(monday.getDate() + 6)
const {
  data: week,
  loading,
  error,
  reload,
} = useQuery('mine:week-workbench', () => getWeekView(localDate(monday), localDate(sunday)))

const overdue = computed(() => week.value?.overdue ?? [])
const todayPending = computed(() =>
  (week.value?.plans ?? []).filter(
    (plan) => plan.status === 'pending' && localDate(new Date(plan.plannedAt)) === today,
  ),
)
const completedCount = computed(
  () => week.value?.plans.filter((plan) => plan.status === 'completed').length ?? 0,
)
const actualCount = computed(
  () => (week.value?.businessRecords.length ?? 0) + (week.value?.complaintRecords.length ?? 0),
)

function execute(plan: SalesPlan) {
  void router.push(salesPlanExecutionRoute(plan))
}
function handleLogout() {
  auth.logout()
  void router.push('/login')
}
function planLabel(kind: SalesPlanKind): string {
  return {
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机跟进',
    complaint_follow_up: '客诉处理',
  }[kind]
}
function dateTime(value: string): string {
  return value
}
</script>

<style scoped>
.mine__loading {
  display: block;
  margin: var(--crm-spacing-xl) auto;
}
.mine__summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1px;
  margin: var(--crm-spacing-md);
  overflow: hidden;
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-border);
}
.mine__summary button {
  display: grid;
  gap: 4px;
  padding: var(--crm-spacing-md) 4px;
  border: 0;
  background: var(--crm-color-bg-card);
  color: inherit;
}
.mine__summary strong {
  font-size: 22px;
}
.mine__summary strong.is-danger {
  color: var(--crm-color-danger);
}
.mine__summary span {
  color: var(--crm-color-text-secondary);
  font-size: 11px;
}
.mine__profile,
.mine__tools {
  margin-top: var(--crm-spacing-md);
}
.mine__logout {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
