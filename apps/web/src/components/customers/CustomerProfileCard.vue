<template>
  <el-card class="profile-card">
    <template #header>
      <div class="profile-card__header">
        <span>基本信息</span>
        <el-button v-if="editable" size="small" @click="emit('edit')">编辑资料</el-button>
      </div>
    </template>
    <el-descriptions :column="2" border>
      <el-descriptions-item label="名称">{{ customer.name }}</el-descriptions-item>
      <el-descriptions-item label="客户等级">{{ customer.grade }}</el-descriptions-item>
      <el-descriptions-item label="经营阶段">{{ relationshipLabel }}</el-descriptions-item>
      <el-descriptions-item label="ERP 客户编码">{{
        customer.customerCode ?? '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="统一社会信用代码">
        {{ customer.unifiedSocialCreditCode ?? '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="省份 / 城市">
        {{ [customer.province, customer.city].filter(Boolean).join(' / ') || '-' }}
      </el-descriptions-item>
      <el-descriptions-item label="销售大区">{{
        customer.salesRegionName ?? '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="客户行业">
        {{ dimensionLabel('industry', customer.industry) }}
      </el-descriptions-item>
      <el-descriptions-item label="具体领域">{{
        dimensionLabel('sub_industry', customer.subIndustry)
      }}</el-descriptions-item>
      <el-descriptions-item label="客户类型">
        {{ dimensionLabel('customer_type', customer.customerType) }}
      </el-descriptions-item>
      <el-descriptions-item label="客户来源">
        {{ dimensionLabel('source', customer.source) }}
      </el-descriptions-item>
      <el-descriptions-item label="关注产品线">
        {{ productLineText }}
      </el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="customer.status === 'active' ? 'success' : 'warning'">
          {{ statusLabel }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="负责人">{{ ownerLabel }}</el-descriptions-item>
      <el-descriptions-item label="地址" :span="2">{{
        customer.address ?? '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="网址" :span="2">{{
        customer.website ?? '-'
      }}</el-descriptions-item>
      <el-descriptions-item label="备注" :span="2">{{
        customer.notes ?? '-'
      }}</el-descriptions-item>
    </el-descriptions>
  </el-card>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  CUSTOMER_RELATIONSHIP_STAGE_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  listDimensionOptions,
  type CustomerDetail,
  type CustomerDimension,
} from '@crm/domain'

const props = defineProps<{
  customer: CustomerDetail
  ownerLabel: string
  editable: boolean
}>()
const emit = defineEmits<{ edit: [] }>()

const labels = ref<Record<string, string>>({})
const dimensions: CustomerDimension[] = [
  'industry',
  'sub_industry',
  'customer_type',
  'source',
  'product_line',
]

onMounted(async () => {
  const groups = await Promise.all(
    dimensions.map((dimension) => listDimensionOptions(dimension).catch(() => [])),
  )
  for (const options of groups) {
    for (const option of options) labels.value[`${option.dimension}:${option.name}`] = option.label
  }
})

const statusLabel = computed(
  () =>
    CUSTOMER_STATUS_OPTIONS.find((item) => item.value === props.customer.status)?.label ??
    props.customer.status,
)
const relationshipLabel = computed(
  () =>
    CUSTOMER_RELATIONSHIP_STAGE_OPTIONS.find(
      (item) => item.value === props.customer.relationshipStage,
    )?.label ?? props.customer.relationshipStage,
)
const productLineText = computed(
  () =>
    props.customer.productLines.map((value) => dimensionLabel('product_line', value)).join('、') ||
    '-',
)

function dimensionLabel(dimension: CustomerDimension, value?: string | null): string {
  if (!value) return '-'
  return labels.value[`${dimension}:${value}`] ?? value
}
</script>

<style scoped>
.profile-card {
  margin-bottom: 0;
}
.profile-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
