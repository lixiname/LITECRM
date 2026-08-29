<template>
  <el-drawer v-model="visible" :title="detail?.title ?? '业务记录'" size="460px">
    <div v-loading="loading" class="actual-detail">
      <el-alert v-if="error" type="error" :closable="false" :title="error" show-icon />
      <template v-else-if="detail">
        <el-descriptions v-if="plan" class="actual-detail__plan" :column="1" border title="原计划">
          <el-descriptions-item label="计划时间">{{
            formatTime(plan.plannedAt)
          }}</el-descriptions-item>
          <el-descriptions-item label="计划内容">{{ plan.content }}</el-descriptions-item>
        </el-descriptions>
        <el-descriptions :column="1" border>
          <el-descriptions-item label="发生时间">{{
            formatTime(detail.occurredAt)
          }}</el-descriptions-item>
          <el-descriptions-item label="客户">{{ detail.customerName }}</el-descriptions-item>
          <el-descriptions-item label="记录来源">
            {{ detail.sourcePlanId ? '执行计划后形成' : '直接登记的计划外实际' }}
          </el-descriptions-item>
          <el-descriptions-item
            v-for="field in detail.fields"
            :key="field.label"
            :label="field.label"
          >
            {{ field.value }}
          </el-descriptions-item>
        </el-descriptions>
        <el-button class="actual-detail__link" type="primary" plain @click="openRelated">
          {{ detail.relatedLabel }}
        </el-button>
      </template>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  getActualRecordDetail,
  type ActualRecordDetail,
  type ActualRecordReference,
  type SalesPlan,
} from '@crm/domain'

const props = defineProps<{ record?: ActualRecordReference; plan?: SalesPlan }>()
const visible = defineModel<boolean>({ required: true })
const router = useRouter()
const detail = ref<ActualRecordDetail>()
const loading = ref(false)
const error = ref('')

watch(
  [visible, () => props.record],
  async ([isVisible, record]) => {
    if (!isVisible || !record) return
    loading.value = true
    error.value = ''
    detail.value = undefined
    try {
      detail.value = await getActualRecordDetail(record)
    } catch (loadError) {
      error.value = loadError instanceof Error ? loadError.message : '记录加载失败'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function openRelated() {
  if (!detail.value) return
  const prefix =
    detail.value.relatedType === 'customer'
      ? '/customers'
      : detail.value.relatedType === 'opportunity'
        ? '/opportunities'
        : '/complaints'
  visible.value = false
  void router.push(`${prefix}/${detail.value.relatedId}`)
}

function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.actual-detail__plan {
  margin-bottom: var(--crm-spacing-lg);
}
.actual-detail__link {
  width: 100%;
  margin-top: var(--crm-spacing-lg);
}
</style>
