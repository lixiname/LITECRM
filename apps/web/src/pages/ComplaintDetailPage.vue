<template>
  <div v-loading="loading" class="c-detail" :class="{ 'c-detail--embedded': embedded }">
    <AppPageHeader
      v-if="!embedded"
      :title="complaint?.description ?? '客诉详情'"
      description="从登记、处理行动到解决结果的完整生命周期"
      back-to="/complaints"
      back-label="客诉列表"
    >
      <template #actions>
        <el-button
          v-if="complaint && complaint.status === 'registered'"
          type="primary"
          @click="openFollow()"
        >
          跟进 / 确认解决
        </el-button>
      </template>
    </AppPageHeader>

    <div v-else-if="complaint" class="c-detail__embedded-head">
      <div>
        <strong>{{ complaint.description }}</strong>
        <span>{{ complaint.customerName }}</span>
      </div>
      <el-button v-if="complaint.status === 'registered'" type="primary" @click="openFollow()">
        处理 / 确认解决
      </el-button>
    </div>

    <el-card v-if="complaint" class="c-detail__summary">
      <div class="c-summary">
        <div>
          <span>当前状态</span>
          <el-tag :type="complaint.status === 'resolved' ? 'success' : 'danger'">
            {{ complaint.status === 'resolved' ? '已解决' : '处理中' }}
          </el-tag>
        </div>
        <div>
          <span>客诉类型</span>
          <strong>{{ typeLabel(complaint.type) }}</strong>
        </div>
        <div>
          <span>所属客户</span>
          <el-button link type="primary" @click="router.push(`/customers/${complaint.customerId}`)">
            {{ complaint.customerName }}
          </el-button>
        </div>
        <div>
          <span>持续时间</span>
          <strong>{{ durationText() }}</strong>
        </div>
      </div>
    </el-card>

    <el-card v-if="complaint" class="c-detail__card">
      <template #header>
        <div class="c-detail__timeline-title">
          <strong>处理时间线</strong>
          <span>历史事实只追加，待办节点表示下一步</span>
        </div>
      </template>
      <el-timeline class="c-timeline">
        <el-timeline-item
          v-for="item in complaint.timeline"
          :key="item.id"
          :timestamp="formatTime(item.timestamp)"
          :type="timelineType(item.status)"
          :hollow="item.status === 'pending' || item.status === 'overdue'"
          placement="top"
        >
          <div class="timeline-node" :class="`timeline-node--${item.status}`">
            <div class="timeline-node__header">
              <strong>{{ item.title }}</strong>
              <el-tag v-if="item.status === 'overdue'" type="danger" size="small">已逾期</el-tag>
              <el-tag v-else-if="item.status === 'pending'" type="warning" size="small"
                >待处理</el-tag
              >
              <el-tag v-else-if="item.status === 'resolved'" type="success" size="small"
                >终点</el-tag
              >
            </div>
            <p>{{ item.content }}</p>
            <small v-if="item.actorName">处理人：{{ item.actorName }}</small>
          </div>
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <ComplaintCommandDialog
      v-if="complaint"
      ref="commandDialog"
      :complaint="complaint"
      @changed="handleChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  useQuery,
  getComplaint,
  listDimensionOptions,
  type ComplaintTimelineStatus,
  type SalesPlan,
} from '@crm/domain'
import AppPageHeader from '../components/AppPageHeader.vue'
import ComplaintCommandDialog from '../components/complaints/ComplaintCommandDialog.vue'

const route = useRoute()
const router = useRouter()
const props = withDefaults(defineProps<{ complaintId?: string; embedded?: boolean }>(), {
  complaintId: undefined,
  embedded: false,
})
const emit = defineEmits<{ changed: [] }>()
const embedded = computed(() => props.embedded)
const activeComplaintId = computed(() => props.complaintId ?? (route.params.id as string))

const {
  data: complaint,
  loading,
  reload,
} = useQuery(`complaint:detail:${activeComplaintId.value}`, () =>
  getComplaint(activeComplaintId.value),
)
const { data: typeOptions } = useQuery('catalog:complaint_type', () =>
  listDimensionOptions('complaint_type'),
)
const commandDialog = ref<InstanceType<typeof ComplaintCommandDialog>>()

const routePlanOpened = ref(false)
watch(activeComplaintId, () => {
  routePlanOpened.value = false
  void reload()
})
watch(
  () => complaint.value,
  async (value) => {
    if (!value || routePlanOpened.value || !route.query.executePlan) return
    if (value.actions[0]?.id !== route.query.executePlan) {
      ElMessage.error('该计划不是当前客诉的待处理计划')
      return
    }
    await nextTick()
    openFollow(value.actions[0])
    routePlanOpened.value = true
  },
  { immediate: true },
)

function typeLabel(type: string): string {
  return typeOptions.value?.find((option) => option.name === type)?.label ?? type
}
function formatTime(v: string): string {
  if (!v) return '-'
  return v.length === 10 ? v : new Date(v).toLocaleString('zh-CN', { hour12: false })
}
function durationText(): string {
  if (!complaint.value) return '-'
  const end = complaint.value.resolvedAt ? new Date(complaint.value.resolvedAt) : new Date()
  const days = Math.max(
    0,
    Math.ceil((end.getTime() - new Date(complaint.value.occurredAt).getTime()) / 86_400_000),
  )
  return days === 0 ? '当天' : `${days} 天`
}
function timelineType(
  status: ComplaintTimelineStatus,
): 'primary' | 'success' | 'danger' | 'warning' {
  if (status === 'resolved') return 'success'
  if (status === 'overdue') return 'danger'
  if (status === 'pending') return 'warning'
  return 'primary'
}

function openFollow(plan?: SalesPlan) {
  commandDialog.value?.open(plan)
}

async function handleChanged() {
  await reload()
  emit('changed')
}
</script>

<style scoped>
.c-detail {
  padding: var(--crm-spacing-xl);
}
.c-detail__card {
  width: 100%;
  max-width: none;
  margin-bottom: var(--crm-spacing-lg);
}
.c-detail--embedded {
  padding: 0;
}
.c-detail__embedded-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
  margin-bottom: var(--crm-spacing-md);
}
.c-detail__embedded-head > div {
  display: flex;
  flex-direction: column;
  gap: var(--crm-spacing-xs);
}
.c-detail__embedded-head span {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
}
.c-detail__summary {
  margin-bottom: var(--crm-spacing-lg);
}
.c-summary {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--crm-spacing-lg);
}
.c-summary > div {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--crm-spacing-xs);
}
.c-summary span,
.c-detail__timeline-title span,
.timeline-node small {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
}
.c-detail__timeline-title {
  display: flex;
  align-items: baseline;
  gap: var(--crm-spacing-sm);
}
.c-timeline {
  max-width: 860px;
  padding-top: var(--crm-spacing-sm);
}
.timeline-node {
  padding: var(--crm-spacing-md);
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.timeline-node--pending,
.timeline-node--overdue {
  border-style: dashed;
}
.timeline-node--overdue {
  border-color: var(--el-color-danger-light-5);
  background: var(--el-color-danger-light-9);
}
.timeline-node--resolved {
  border-color: var(--el-color-success-light-5);
  background: var(--el-color-success-light-9);
}
.timeline-node__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-sm);
}
.timeline-node p {
  margin: var(--crm-spacing-xs) 0;
  line-height: 1.6;
}
@media (max-width: 900px) {
  .c-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
