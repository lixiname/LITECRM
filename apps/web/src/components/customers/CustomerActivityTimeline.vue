<template>
  <el-card class="activity-card">
    <template #header>
      <div class="activity-card__header">
        <span>客户活动时间线</span>
        <span class="activity-card__hint">业务活动、经营结果与归属变化统一查看</span>
      </div>
    </template>
    <el-empty v-if="!items.length" description="还没有客户活动" :image-size="72" />
    <el-timeline v-else>
      <el-timeline-item
        v-for="item in items"
        :key="`${item.type}-${item.id}`"
        :timestamp="timeText(item.occurredAt)"
        :type="timelineType(item.type)"
      >
        <div
          class="activity-card__item"
          :class="{ 'activity-card__item--link': canOpen(item) }"
          @click="openItem(item)"
        >
          <div class="activity-card__title">
            <span>{{ item.title }}</span>
            <el-tag size="small" effect="plain">{{ typeLabel(item.type) }}</el-tag>
          </div>
          <div>{{ item.summary }}</div>
          <div v-if="metadataText(item)" class="activity-card__meta">{{ metadataText(item) }}</div>
        </div>
      </el-timeline-item>
    </el-timeline>
  </el-card>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  listDimensionOptions,
  OPPORTUNITY_STAGE_OPTIONS,
  VISIT_METHOD_OPTIONS,
  type CustomerTimelineItem,
} from '@crm/domain'

defineProps<{ items: CustomerTimelineItem[] }>()
const router = useRouter()
const visitTypeLabels = ref<Record<string, string>>({})

onMounted(async () => {
  const options = await listDimensionOptions('visit_type').catch(() => [])
  visitTypeLabels.value = Object.fromEntries(options.map((option) => [option.name, option.label]))
})

function canOpen(item: CustomerTimelineItem): boolean {
  return item.targetType === 'opportunity' || item.targetType === 'complaint'
}
function openItem(item: CustomerTimelineItem) {
  if (!canOpen(item)) return
  void router.push(
    `/${item.targetType === 'opportunity' ? 'opportunities' : 'complaints'}/${item.targetId}`,
  )
}
function timeText(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
function typeLabel(type: CustomerTimelineItem['type']): string {
  const labels: Record<CustomerTimelineItem['type'], string> = {
    visit: '拜访',
    opportunity: '商机',
    opportunity_follow_up: '商机推进',
    quote: '报价',
    complaint: '客诉',
    complaint_follow_up: '客诉跟进',
    deal: '成交',
    ownership_event: '归属与状态',
  }
  return labels[type]
}
function timelineType(
  type: CustomerTimelineItem['type'],
): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  if (type === 'deal') return 'success'
  if (type === 'complaint' || type === 'complaint_follow_up') return 'danger'
  if (type === 'quote') return 'warning'
  if (type === 'visit') return 'primary'
  if (type === 'ownership_event') return 'info'
  return 'info'
}
function metadataText(item: CustomerTimelineItem): string {
  if (item.type === 'visit') {
    const method = VISIT_METHOD_OPTIONS.find(
      (option) => option.value === item.metadata?.method,
    )?.label
    const visitType = item.metadata?.visitType
      ? (visitTypeLabels.value[item.metadata.visitType] ?? item.metadata.visitType)
      : undefined
    return [method, visitType].filter(Boolean).join(' · ')
  }
  if (item.type === 'opportunity') {
    return (
      OPPORTUNITY_STAGE_OPTIONS.find((option) => option.value === item.metadata?.stage)?.label ?? ''
    )
  }
  if (item.type === 'opportunity_follow_up') {
    return item.metadata?.opportunityName ?? ''
  }
  if (item.type === 'quote')
    return item.metadata?.quoteNo ? `报价单号：${item.metadata.quoteNo}` : ''
  if (item.type === 'ownership_event') return item.metadata?.operatedByName ?? ''
  return ''
}
</script>

<style scoped>
.activity-card {
  margin-bottom: var(--crm-spacing-lg);
}
.activity-card__header,
.activity-card__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-sm);
}
.activity-card__hint,
.activity-card__meta {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.activity-card__item--link {
  cursor: pointer;
}
.activity-card__item--link:hover .activity-card__title > span:first-child {
  color: var(--crm-color-primary);
}
</style>
