<template>
  <div class="team-panel">
    <div class="team-panel__toolbar">
      <el-segmented v-model="mode" :options="modeOptions" @change="changeMode" />
      <div class="team-panel__period">
        <el-button text aria-label="上一期" @click="movePeriod(-1)">‹</el-button>
        <strong>{{ periodLabel }}</strong>
        <el-button text aria-label="下一期" @click="movePeriod(1)">›</el-button>
        <el-button size="small" @click="goCurrent">
          {{ mode === 'day' ? '回到今天' : '回到本周' }}
        </el-button>
      </div>
    </div>

    <section v-for="group in regionGroups" :key="group.key" class="team-panel__region">
      <header class="team-panel__region-head">
        <div>
          <strong>{{ group.name }}</strong>
          <small>{{ group.members.length }} 人</small>
        </div>
        <span>
          实际记录 {{ sum(group.members, 'actualRecordCount') }} · 待执行
          {{ sum(group.members, 'pendingCount') }} · 逾期
          {{ sum(group.members, 'overdueCount') }}
        </span>
      </header>

      <el-table
        :data="group.members"
        border
        row-class-name="team-panel__row"
        @row-click="openPeriod"
      >
        <el-table-column prop="ownerName" label="人员" min-width="115" fixed />
        <el-table-column v-if="mode === 'day'" label="当前状态" width="100">
          <template #default="{ row }">
            <el-tag :type="statusOf(row as TeamMemberReport).type" effect="plain">
              {{ statusOf(row as TeamMemberReport).label }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="pendingCount"
          :label="mode === 'day' ? '今日待执行' : '本周待执行'"
          width="105"
          align="right"
        />
        <el-table-column prop="completedPlanCount" label="已执行计划" width="105" align="right" />
        <el-table-column prop="actualRecordCount" label="实际记录" width="95" align="right" />
        <el-table-column prop="visits" label="拜访" width="70" align="right" />
        <el-table-column prop="opportunityFollowUps" label="商机推进" width="90" align="right" />
        <el-table-column prop="quotes" label="报价" width="70" align="right" />
        <el-table-column label="报价金额" min-width="115" align="right">
          <template #default="{ row }">{{ money((row as TeamMemberReport).quoteAmount) }}</template>
        </el-table-column>
        <el-table-column label="逾期" width="75" align="right">
          <template #default="{ row }">
            <span :class="{ 'team-panel__danger': (row as TeamMemberReport).overdueCount > 0 }">
              {{ (row as TeamMemberReport).overdueCount }}
            </span>
          </template>
        </el-table-column>
        <el-table-column :label="mode === 'day' ? '今日重点' : '需要关注'" min-width="250">
          <template #default="{ row }">
            <span v-if="mode === 'day' && (row as TeamMemberReport).topPlans[0]">
              {{ (row as TeamMemberReport).topPlans[0]?.customerName }} ·
              {{ (row as TeamMemberReport).topPlans[0]?.content }}
              <small v-if="(row as TeamMemberReport).topPlans.length > 1" class="team-panel__muted">
                等 {{ (row as TeamMemberReport).topPlans.length }} 项
              </small>
            </span>
            <span v-else-if="(row as TeamMemberReport).topOverdue[0]">
              {{ (row as TeamMemberReport).topOverdue[0]?.customerName }} ·
              {{ (row as TeamMemberReport).topOverdue[0]?.content }}
            </span>
            <span
              v-else-if="mode === 'day' && (row as TeamMemberReport).actualRecordCount > 0"
              class="team-panel__muted"
            >
              已产生 {{ (row as TeamMemberReport).actualRecordCount }} 条实际记录
            </span>
            <span v-else class="team-panel__muted">{{
              mode === 'day' ? '暂无安排' : '暂无逾期'
            }}</span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <el-drawer
      v-model="drawerVisible"
      :title="`${selected?.ownerName ?? ''} · ${mode === 'day' ? '当日内容' : '本周内容'}`"
      size="88%"
      destroy-on-close
    >
      <div v-loading="weekLoading" class="team-panel__week">
        <div v-if="week?.overdue.length" class="team-panel__older-overdue">
          <strong>更早逾期 {{ week.overdue.length }} 项</strong>
          <div v-for="item in week.overdue.slice(0, 5)" :key="item.id" class="team-panel__line">
            <span
              >{{ dateText(item.plannedAt) }} · {{ item.customerName }} · {{ item.content }}</span
            >
            <el-button size="small" text type="primary" @click="openGuidance(item)">
              {{ guidanceLabel(item) }}
            </el-button>
          </div>
        </div>
        <section v-for="day in days" :key="day.date" class="team-panel__day">
          <header>
            <strong>{{ day.label }}</strong>
            <small>{{ day.plans.length }} 项计划 · {{ day.records.length }} 条实际记录</small>
          </header>
          <div class="team-panel__day-body">
            <div>
              <h4>计划与执行</h4>
              <div v-for="plan in day.plans" :key="plan.id" class="team-panel__line">
                <el-tag :type="plan.status === 'pending' ? 'primary' : 'info'" size="small">
                  {{
                    plan.status === 'pending'
                      ? '待执行'
                      : plan.status === 'completed'
                        ? '已执行'
                        : '已取消'
                  }}
                </el-tag>
                <span>{{ plan.customerName }} · {{ plan.content }}</span>
                <el-button
                  v-if="plan.status === 'pending' || plan.guidanceCount"
                  size="small"
                  text
                  type="primary"
                  @click="openGuidance(plan)"
                >
                  {{ guidanceLabel(plan) }}
                </el-button>
              </div>
              <small v-if="!day.plans.length" class="team-panel__muted">无计划</small>
            </div>
            <div>
              <h4>已发生</h4>
              <div
                v-for="record in day.records"
                :key="`${record.type}-${record.id}`"
                class="team-panel__line"
              >
                <el-tag type="success" size="small">{{ recordLabel(record.type) }}</el-tag>
                <span>{{ record.customerName }} · {{ record.summary }}</span>
              </div>
              <small v-if="!day.records.length" class="team-panel__muted">无业务记录</small>
            </div>
          </div>
        </section>
      </div>
    </el-drawer>
    <PlanGuidanceDialog
      v-model="guidanceVisible"
      :plan="guidancePlan"
      can-comment
      @changed="reloadSelectedWeek"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PlanGuidanceDialog from '../planning/PlanGuidanceDialog.vue'
import {
  getWeekView,
  type ActionWeekView,
  type ReportingFilters,
  type SalesPlan,
  type TeamMemberReport,
  type TeamReport,
} from '@crm/domain'

const props = defineProps<{ data: TeamReport; filters: ReportingFilters }>()
const emit = defineEmits<{ 'range-change': [range: [string, string]] }>()
const mode = ref<'day' | 'week'>('day')
const anchor = ref(new Date(`${props.filters.start}T00:00:00`))
const modeOptions = [
  { label: '今日团队', value: 'day' },
  { label: '本周个人', value: 'week' },
]
const selected = ref<TeamMemberReport>()
const week = ref<ActionWeekView>()
const drawerVisible = ref(false)
const weekLoading = ref(false)
const guidanceVisible = ref(false)
const guidancePlan = ref<SalesPlan>()

type ActualRecord =
  ActionWeekView['businessRecords'][number] | ActionWeekView['complaintRecords'][number]
const regionGroups = computed(() => {
  const groups = new Map<string, { key: string; name: string; members: TeamMemberReport[] }>()
  for (const member of props.data.members) {
    const key = member.salesRegionId ?? '__unassigned__'
    const group = groups.get(key) ?? {
      key,
      name: member.salesRegionName ?? '未分配大区',
      members: [],
    }
    group.members.push(member)
    groups.set(key, group)
  }
  return [...groups.values()]
})
const periodLabel = computed(() => {
  if (mode.value === 'day') {
    return anchor.value.toLocaleDateString('zh-CN', {
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    })
  }
  const [start, end] = currentRange()
  return `${shortDate(start)} — ${shortDate(end)}`
})
const days = computed(() => {
  const result: {
    date: string
    label: string
    plans: ActionWeekView['plans']
    records: ActualRecord[]
  }[] = []
  const cursor = new Date(`${props.filters.start}T00:00:00`)
  const end = new Date(`${props.filters.end}T00:00:00`)
  while (cursor <= end && result.length < 7) {
    const date = localDate(cursor)
    result.push({
      date,
      label: cursor.toLocaleDateString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        weekday: 'short',
      }),
      plans: (week.value?.plans ?? []).filter(
        (item) => localDate(new Date(item.plannedAt)) === date,
      ),
      records: [...(week.value?.businessRecords ?? []), ...(week.value?.complaintRecords ?? [])]
        .filter((item) => localDate(new Date(item.occurredAt)) === date)
        .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()),
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return result
})

function changeMode() {
  anchor.value = new Date()
  emit('range-change', currentRange())
}
function movePeriod(direction: number) {
  const next = new Date(anchor.value)
  next.setDate(next.getDate() + direction * (mode.value === 'day' ? 1 : 7))
  anchor.value = next
  emit('range-change', currentRange())
}
function goCurrent() {
  anchor.value = new Date()
  emit('range-change', currentRange())
}
function currentRange(): [string, string] {
  if (mode.value === 'day') {
    const date = localDate(anchor.value)
    return [date, date]
  }
  const monday = new Date(anchor.value)
  const day = monday.getDay() || 7
  monday.setDate(monday.getDate() - day + 1)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return [localDate(monday), localDate(sunday)]
}
async function openPeriod(member: TeamMemberReport) {
  selected.value = member
  drawerVisible.value = true
  await reloadSelectedWeek()
}
async function reloadSelectedWeek() {
  if (!selected.value) return
  weekLoading.value = true
  try {
    week.value = await getWeekView(props.filters.start, props.filters.end, selected.value.ownerId)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '内容加载失败')
  } finally {
    weekLoading.value = false
  }
}
function openGuidance(plan: SalesPlan) {
  guidancePlan.value = plan
  guidanceVisible.value = true
}
function guidanceLabel(plan: SalesPlan): string {
  return plan.guidanceCount ? `指导 ${plan.guidanceCount}` : '写指导'
}
function sum(
  members: TeamMemberReport[],
  key: 'actualRecordCount' | 'pendingCount' | 'overdueCount',
) {
  return members.reduce((total, member) => total + member[key], 0)
}
function statusOf(member: TeamMemberReport): {
  label: string
  type: 'danger' | 'success' | 'primary' | 'info'
} {
  if (member.overdueCount > 0) return { label: '需关注', type: 'danger' }
  if (member.actualRecordCount > 0 || member.completedPlanCount > 0) {
    return { label: '已推进', type: 'success' }
  }
  if (member.pendingCount > 0) return { label: '待执行', type: 'primary' }
  return { label: '未安排', type: 'info' }
}
function localDate(date: Date): string {
  return date.toLocaleDateString('sv-SE')
}
function shortDate(value: string): string {
  return value.slice(5).replace('-', '/')
}
function dateText(value: string): string {
  return new Date(value).toLocaleDateString('zh-CN')
}
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
function recordLabel(type: ActualRecord['type']): string {
  return {
    opportunity_created: '发现商机',
    customer_visit: '拜访',
    opportunity_follow_up: '商机跟进',
    opportunity_quote: '报价',
    complaint_registered: '客诉登记',
    complaint_follow_up: '客诉处理',
  }[type]
}
</script>

<style scoped>
.team-panel {
  display: grid;
  gap: var(--crm-spacing-lg);
}
.team-panel__toolbar,
.team-panel__period,
.team-panel__region-head,
.team-panel__region-head > div,
.team-panel__day header {
  display: flex;
  align-items: center;
}
.team-panel__toolbar,
.team-panel__region-head,
.team-panel__day header {
  justify-content: space-between;
}
.team-panel__period {
  gap: var(--crm-spacing-xs);
}
.team-panel__period strong {
  min-width: 160px;
  text-align: center;
}
.team-panel__region {
  display: grid;
  gap: var(--crm-spacing-sm);
}
.team-panel__region-head {
  padding: 0 2px;
}
.team-panel__region-head > div {
  gap: var(--crm-spacing-sm);
}
.team-panel__region-head small,
.team-panel__region-head span,
.team-panel__muted {
  color: var(--crm-color-text-secondary);
}
.team-panel__danger {
  color: var(--el-color-danger);
  font-weight: 600;
}
:deep(.team-panel__row) {
  cursor: pointer;
}
.team-panel__week {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--crm-spacing-md);
}
.team-panel__older-overdue {
  display: grid;
  grid-column: 1 / -1;
  gap: var(--crm-spacing-xs);
  padding: var(--crm-spacing-md);
  border-radius: var(--crm-radius-md);
  background: var(--el-color-danger-light-9);
}
.team-panel__day {
  overflow: hidden;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
}
.team-panel__day header {
  gap: var(--crm-spacing-md);
  padding: var(--crm-spacing-md);
  border-bottom: 1px solid var(--crm-color-border);
  background: var(--crm-color-bg-page);
}
.team-panel__day header small {
  color: var(--crm-color-text-secondary);
}
.team-panel__day-body {
  display: grid;
  gap: var(--crm-spacing-lg);
  padding: var(--crm-spacing-md);
}
.team-panel__day-body h4 {
  margin: 0 0 var(--crm-spacing-sm);
}
.team-panel__line {
  display: flex;
  align-items: flex-start;
  gap: var(--crm-spacing-sm);
  margin-top: var(--crm-spacing-sm);
  line-height: 1.5;
}
</style>
