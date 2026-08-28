<template>
  <div class="team-panel">
    <div class="team-panel__grid">
      <button
        v-for="member in data.members"
        :key="member.ownerId"
        type="button"
        class="team-panel__member"
        @click="openWeek(member)"
      >
        <div class="team-panel__member-head">
          <strong>{{ member.ownerName }}</strong>
          <el-tag v-if="member.overdueCount" type="danger" effect="plain">
            逾期 {{ member.overdueCount }}
          </el-tag>
          <el-tag v-else type="success" effect="plain">无逾期</el-tag>
        </div>
        <div class="team-panel__numbers">
          <span
            ><b>{{ member.actualRecordCount }}</b
            ><small>实际记录</small></span
          >
          <span
            ><b>{{ member.pendingCount }}</b
            ><small>本期待办</small></span
          >
          <span
            ><b>{{ member.quotes }}</b
            ><small>报价</small></span
          >
          <span
            ><b>{{ member.visits }}</b
            ><small>拜访</small></span
          >
        </div>
        <div class="team-panel__mix">
          跟进 {{ member.opportunityFollowUps }} · 客诉处理 {{ member.complaintRecords }} · 报价额
          {{ money(member.quoteAmount) }}
        </div>
        <div v-if="member.topOverdue.length" class="team-panel__overdue">
          <small>最早逾期</small>
          <span
            >{{ member.topOverdue[0]?.customerName }} · {{ member.topOverdue[0]?.content }}</span
          >
        </div>
        <div class="team-panel__open">查看期间内容 →</div>
      </button>
    </div>

    <el-drawer
      v-model="drawerVisible"
      :title="`${selected?.ownerName ?? ''} · 期间内容`"
      size="88%"
      destroy-on-close
    >
      <div v-loading="weekLoading" class="team-panel__week">
        <div v-if="week?.overdue.length" class="team-panel__older-overdue">
          <strong>更早逾期 {{ week.overdue.length }} 项</strong>
          <span v-for="item in week.overdue.slice(0, 5)" :key="item.id">
            {{ dateText(item.plannedAt) }} · {{ item.customerName }} · {{ item.content }}
          </span>
        </div>
        <section v-for="day in days" :key="day.date" class="team-panel__day">
          <header>
            <strong>{{ day.label }}</strong>
            <small>{{ day.plans.length }} 项待办/计划 · {{ day.records.length }} 条实际记录</small>
          </header>
          <div class="team-panel__day-body">
            <div>
              <h4>待执行与已结束计划</h4>
              <div v-for="plan in day.plans" :key="plan.id" class="team-panel__line">
                <el-tag :type="plan.status === 'pending' ? 'primary' : 'info'" size="small">
                  {{
                    plan.status === 'pending'
                      ? '待执行'
                      : plan.status === 'completed'
                        ? '已完成'
                        : '已取消'
                  }}
                </el-tag>
                <span>{{ plan.customerName }} · {{ plan.content }}</span>
              </div>
              <small v-if="!day.plans.length" class="team-panel__empty">无计划</small>
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
              <small v-if="!day.records.length" class="team-panel__empty">无业务记录</small>
            </div>
          </div>
        </section>
      </div>
    </el-drawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  getWeekView,
  type ActionWeekView,
  type ReportingFilters,
  type TeamMemberReport,
  type TeamReport,
} from '@crm/domain'

const props = defineProps<{ data: TeamReport; filters: ReportingFilters }>()
const selected = ref<TeamMemberReport>()
const week = ref<ActionWeekView>()
const drawerVisible = ref(false)
const weekLoading = ref(false)

type ActualRecord =
  ActionWeekView['businessRecords'][number] | ActionWeekView['complaintRecords'][number]
const days = computed(() => {
  const result: {
    date: string
    label: string
    plans: ActionWeekView['plans']
    records: ActualRecord[]
  }[] = []
  const cursor = new Date(`${props.filters.start}T00:00:00`)
  const end = new Date(`${props.filters.end}T00:00:00`)
  while (cursor <= end && result.length < 31) {
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

async function openWeek(member: TeamMemberReport) {
  selected.value = member
  drawerVisible.value = true
  weekLoading.value = true
  try {
    week.value = await getWeekView(props.filters.start, props.filters.end, member.ownerId)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '期间内容加载失败')
  } finally {
    weekLoading.value = false
  }
}
function localDate(date: Date): string {
  return date.toLocaleDateString('sv-SE')
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
.team-panel__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--crm-spacing-md);
}
.team-panel__member {
  display: grid;
  gap: var(--crm-spacing-md);
  padding: var(--crm-spacing-lg);
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.team-panel__member:hover {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 5px 18px rgb(31 35 41 / 8%);
}
.team-panel__member-head,
.team-panel__day header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
}
.team-panel__numbers {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--crm-spacing-sm);
}
.team-panel__numbers span {
  display: grid;
  gap: 2px;
  padding: var(--crm-spacing-sm);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-bg-page);
  text-align: center;
}
.team-panel__numbers b {
  font-size: var(--crm-font-size-lg);
}
.team-panel__numbers small,
.team-panel__mix,
.team-panel__empty {
  color: var(--crm-color-text-secondary);
}
.team-panel__overdue {
  display: grid;
  gap: 4px;
  padding: var(--crm-spacing-sm);
  border-left: 3px solid var(--el-color-danger);
  background: var(--el-color-danger-light-9);
}
.team-panel__open {
  color: var(--crm-color-primary);
  text-align: right;
}
.team-panel__week {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
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
