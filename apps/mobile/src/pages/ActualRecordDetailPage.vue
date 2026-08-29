<template>
  <div class="actual-record">
    <van-nav-bar :title="detail?.title ?? '业务记录'" left-arrow @click-left="router.back()" />
    <van-loading v-if="loading" class="actual-record__loading" />
    <van-empty v-else-if="error" :description="error" />
    <template v-else-if="detail">
      <van-cell-group v-if="planContent" inset title="原计划" class="actual-record__section">
        <van-cell title="计划时间" :value="formatTime(planAt)" />
        <van-cell title="计划内容" :value="planContent" />
      </van-cell-group>
      <van-cell-group inset title="已发生事实" class="actual-record__section">
        <van-cell title="发生时间" :value="formatTime(detail.occurredAt)" />
        <van-cell title="客户" :value="detail.customerName" />
        <van-cell
          title="记录来源"
          :value="detail.sourcePlanId ? '执行计划后形成' : '直接登记的计划外实际'"
        />
        <van-cell
          v-for="field in detail.fields"
          :key="field.label"
          :title="field.label"
          :value="field.value"
        />
      </van-cell-group>
      <div class="actual-record__footer">
        <van-button block plain round type="primary" @click="openRelated">
          {{ detail.relatedLabel }}
        </van-button>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getActualRecordDetail,
  localBusinessDate,
  type ActualRecordDetail,
  type ActualRecordReference,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const detail = ref<ActualRecordDetail>()
const loading = ref(true)
const error = ref('')
const planAt = String(route.query.planAt ?? '')
const planContent = String(route.query.planContent ?? '')

onMounted(async () => {
  try {
    const type = String(route.params.type) as ActualRecordReference['type']
    const common = {
      id: String(route.params.id),
      type,
      occurredAt: localBusinessDate(),
      customerId: String(route.query.customerId ?? ''),
      customerName: String(route.query.customerName ?? ''),
      summary: '',
      sourcePlanId: route.query.sourcePlanId ? String(route.query.sourcePlanId) : null,
    }
    const record = type.startsWith('complaint_')
      ? ({ ...common, complaintId: String(route.query.complaintId ?? '') } as ActualRecordReference)
      : ({
          ...common,
          opportunityId: route.query.opportunityId ? String(route.query.opportunityId) : null,
          opportunityName: route.query.opportunityName ? String(route.query.opportunityName) : null,
        } as ActualRecordReference)
    detail.value = await getActualRecordDetail(record)
  } catch (loadError) {
    error.value = loadError instanceof Error ? loadError.message : '记录加载失败'
  } finally {
    loading.value = false
  }
})

function openRelated() {
  if (!detail.value) return
  const prefix =
    detail.value.relatedType === 'customer'
      ? '/customers'
      : detail.value.relatedType === 'opportunity'
        ? '/opportunities'
        : '/complaints'
  void router.push(`${prefix}/${detail.value.relatedId}`)
}

function formatTime(value: string): string {
  return value || '-'
}
</script>

<style scoped>
.actual-record {
  min-height: 100vh;
}
.actual-record__loading {
  display: block;
  margin: var(--crm-spacing-xl) auto;
}
.actual-record__section {
  margin-top: var(--crm-spacing-md);
}
.actual-record__footer {
  padding: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
