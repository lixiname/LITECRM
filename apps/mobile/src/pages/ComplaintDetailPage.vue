<template>
  <div class="complaint-detail">
    <van-nav-bar title="客诉详情" left-arrow @click-left="router.back()" />

    <van-cell-group v-if="detail" inset class="complaint-summary">
      <van-cell :title="detail.description" :label="`${detail.customerName} · ${typeLabel(detail.type)}`">
        <template #value>
          <van-tag :type="detail.status === 'resolved' ? 'success' : 'danger'">
            {{ detail.status === 'resolved' ? '已解决' : '处理中' }}
          </van-tag>
        </template>
      </van-cell>
      <van-cell title="持续时间" :value="durationText" />
      <van-cell
        v-if="detail.actions[0]"
        title="当前待办"
        :value="detail.actions[0].content"
        :label="formatTime(detail.actions[0].plannedAt)"
      />
    </van-cell-group>

    <van-cell-group v-if="detail" inset title="处理时间线">
      <div class="complaint-timeline">
        <article
          v-for="item in detail.timeline"
          :key="item.id"
          class="timeline-item"
          :class="`timeline-item--${item.status}`"
        >
          <div class="timeline-item__rail">
            <span class="timeline-item__dot" />
            <span class="timeline-item__line" />
          </div>
          <div class="timeline-item__body">
            <div class="timeline-item__top">
              <strong>{{ item.title }}</strong>
              <van-tag v-if="item.status === 'overdue'" type="danger">已逾期</van-tag>
              <van-tag v-else-if="item.status === 'pending'" type="warning">待处理</van-tag>
              <van-tag v-else-if="item.status === 'resolved'" type="success">已解决</van-tag>
            </div>
            <p>{{ item.content }}</p>
            <small>{{ formatTime(item.timestamp) }}{{ item.actorName ? ` · ${item.actorName}` : '' }}</small>
          </div>
        </article>
      </div>
    </van-cell-group>

    <div v-if="detail?.status === 'registered' && auth.hasAbility('customer.write')" class="action-bar">
      <van-button round block type="primary" @click="openFollowUp">处理 / 确认解决</van-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getComplaint,
  listDimensionOptions,
  useAuthStore,
  useQuery,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const complaintId = String(route.params.id)
const { data: detail } = useQuery(`complaint:detail:${complaintId}`, () =>
  getComplaint(complaintId),
)
const { data: typeOptions } = useQuery('catalog:complaint_type', () =>
  listDimensionOptions('complaint_type'),
)

const durationText = computed(() => {
  if (!detail.value) return '-'
  const end = detail.value.resolvedAt ? new Date(detail.value.resolvedAt) : new Date()
  const days = Math.max(
    0,
    Math.ceil((end.getTime() - new Date(detail.value.occurredAt).getTime()) / 86_400_000),
  )
  return days === 0 ? '当天' : `${days} 天`
})

function typeLabel(type: string): string {
  return typeOptions.value?.find((option) => option.name === type)?.label ?? type
}
function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
function openFollowUp() {
  const planId = detail.value?.actions[0]?.id
  router.push({
    path: `/complaints/${complaintId}/follow-up`,
    query: planId ? { planId } : undefined,
  })
}
</script>

<style scoped>
.complaint-summary {
  margin-top: var(--crm-spacing-md);
}
.complaint-timeline {
  padding: var(--crm-spacing-md);
}
.timeline-item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr);
  min-height: 92px;
}
.timeline-item__rail {
  position: relative;
}
.timeline-item__dot {
  position: absolute;
  top: 5px;
  left: 4px;
  z-index: 1;
  width: 10px;
  height: 10px;
  border: 3px solid var(--crm-color-primary);
  border-radius: 50%;
  background: var(--crm-color-bg-card);
}
.timeline-item__line {
  position: absolute;
  top: 18px;
  bottom: 0;
  left: 9px;
  width: 1px;
  background: var(--crm-color-border);
}
.timeline-item:last-child .timeline-item__line {
  display: none;
}
.timeline-item--pending .timeline-item__dot {
  border-color: var(--crm-color-warning);
}
.timeline-item--overdue .timeline-item__dot {
  border-color: var(--crm-color-danger);
}
.timeline-item--resolved .timeline-item__dot {
  border-color: var(--crm-color-success);
  background: var(--crm-color-success);
}
.timeline-item__body {
  padding: 0 0 var(--crm-spacing-lg) var(--crm-spacing-xs);
}
.timeline-item__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-sm);
}
.timeline-item p {
  margin: var(--crm-spacing-xs) 0;
  color: var(--crm-color-text-primary);
  line-height: 1.5;
}
.timeline-item small {
  color: var(--crm-color-text-secondary);
}
.action-bar {
  padding: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
