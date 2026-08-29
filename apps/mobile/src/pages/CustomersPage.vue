<template>
  <div class="customers">
    <van-nav-bar title="客户" left-arrow @click-left="router.push('/')" />
    <van-search v-model="keyword" placeholder="搜索名称/城市" @search="onSearch" />

    <van-list
      v-model:loading="loading"
      :finished="finished"
      finished-text="没有更多了"
      @load="onLoad"
    >
      <van-cell
        v-for="c in items"
        :key="c.id"
        :title="c.name"
        is-link
        @click="router.push(`/customers/${c.id}`)"
      >
        <template #label>
          <div class="customers__profile">{{ businessProfile(c) }}</div>
          <div class="customers__meta">
            <span>{{ locationText(c) }}</span>
            <span>{{ c.grade }} 级</span>
            <span>{{ relationshipLabel(c.relationshipStage) }}</span>
            <span>{{ statusLabel(c.status) }}</span>
          </div>
          <div :class="['customers__action', { 'is-overdue': isOverdue(c.nextActionAt) }]">
            下一步：{{ nextActionText(c) }}
          </div>
        </template>
      </van-cell>
    </van-list>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  listCustomers,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_RELATIONSHIP_STAGE_OPTIONS,
  listDimensionOptions,
  type CustomerItem,
  type CustomerStatus,
  type CustomerRelationshipStage,
  type DimensionOption,
} from '@crm/domain'

const router = useRouter()
const keyword = ref('')
const items = ref<CustomerItem[]>([])
const loading = ref(false)
const finished = ref(false)
const page = ref(1)
const PAGE_SIZE = 20
const labels = ref<Record<string, string>>({})

onMounted(async () => {
  const groups = await Promise.all([
    listDimensionOptions('industry').catch(() => [] as DimensionOption[]),
    listDimensionOptions('sub_industry').catch(() => [] as DimensionOption[]),
  ])
  for (const options of groups) {
    for (const option of options) labels.value[`${option.dimension}:${option.name}`] = option.label
  }
})

async function onLoad() {
  try {
    const res = await listCustomers({
      keyword: keyword.value.trim(),
      page: page.value,
      pageSize: PAGE_SIZE,
    })
    items.value.push(...res.items)
    finished.value = items.value.length >= res.total
    page.value += 1
  } catch {
    finished.value = true
  } finally {
    loading.value = false
  }
}

function onSearch() {
  items.value = []
  page.value = 1
  finished.value = false
  void onLoad()
}

function statusLabel(status: CustomerStatus): string {
  return CUSTOMER_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}

function relationshipLabel(stage: CustomerRelationshipStage): string {
  return CUSTOMER_RELATIONSHIP_STAGE_OPTIONS.find((item) => item.value === stage)?.label ?? stage
}

function labelOf(dimension: string, value?: string | null): string {
  if (!value) return ''
  return labels.value[`${dimension}:${value}`] ?? value
}

function businessProfile(customer: CustomerItem): string {
  return (
    [labelOf('industry', customer.industry), labelOf('sub_industry', customer.subIndustry)]
      .filter(Boolean)
      .join(' · ') || '业务画像待完善'
  )
}

function locationText(customer: CustomerItem): string {
  return [customer.salesRegionName, customer.city].filter(Boolean).join(' · ') || '地区待完善'
}

function isOverdue(value?: string | null): boolean {
  return Boolean(value && new Date(value).getTime() < Date.now())
}

function nextActionText(customer: CustomerItem): string {
  if (!customer.nextActionAt) return '未安排'
  const date = new Date(customer.nextActionAt).toLocaleDateString('zh-CN')
  return `${date} · ${customer.nextActionContent ?? '待跟进'}`
}
</script>

<style scoped>
.customers__profile {
  margin-top: 2px;
  color: var(--crm-color-text-primary);
}
.customers__meta {
  display: flex;
  gap: 8px;
  color: var(--crm-color-text-secondary);
}
.customers__action {
  margin-top: 3px;
  color: var(--crm-color-primary);
}
.customers__action.is-overdue {
  color: var(--van-danger-color);
}
</style>
