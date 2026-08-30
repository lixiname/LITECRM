<template>
  <div class="customers">
    <van-nav-bar title="客户" left-arrow @click-left="router.push('/')" />
    <van-search v-model="keyword" placeholder="搜索名称/城市" @search="onSearch" />

    <van-pull-refresh v-model="refreshing" @refresh="onRefresh">
      <van-list
        v-model:loading="loading"
        v-model:error="loadError"
        :finished="finished"
        error-text="加载失败，点击重试"
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
        <van-empty v-if="finished && !items.length" description="没有符合条件的客户" />
      </van-list>
    </van-pull-refresh>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  listCustomers,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_RELATIONSHIP_STAGE_OPTIONS,
  isBusinessDateOverdue,
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
const refreshing = ref(false)
const loadError = ref(false)
const finished = ref(false)
const page = ref(1)
const PAGE_SIZE = 20
const labels = ref<Record<string, string>>({})
let queryRevision = 0

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
  const revision = queryRevision
  const requestedPage = page.value
  loadError.value = false
  try {
    const res = await listCustomers({
      keyword: keyword.value.trim(),
      page: requestedPage,
      pageSize: PAGE_SIZE,
    })
    if (revision !== queryRevision) return
    const existingIds = new Set(items.value.map((item) => item.id))
    items.value.push(...res.items.filter((item) => !existingIds.has(item.id)))
    finished.value = items.value.length >= res.total
    page.value = requestedPage + 1
  } catch {
    if (revision === queryRevision) loadError.value = true
  } finally {
    if (revision === queryRevision) {
      loading.value = false
      refreshing.value = false
    }
  }
}

function onSearch() {
  resetList()
  loading.value = true
  void onLoad()
}

function onRefresh() {
  resetList()
  refreshing.value = true
  void onLoad()
}

function resetList() {
  queryRevision += 1
  items.value = []
  page.value = 1
  finished.value = false
  loadError.value = false
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
  return isBusinessDateOverdue(value)
}

function nextActionText(customer: CustomerItem): string {
  if (!customer.nextActionAt) return '未安排'
  const date = new Date(customer.nextActionAt).toLocaleDateString('zh-CN')
  return `${date} · ${customer.nextActionContent ?? '待跟进'}`
}
</script>

<style scoped>
.customers {
  min-height: 100vh;
  background: var(--crm-color-bg-page);
}
.customers :deep(.van-search) {
  padding: 10px var(--crm-spacing-md);
  background: var(--crm-color-bg-page);
}
.customers :deep(.van-search__content) {
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.customers :deep(.van-list) {
  display: grid;
  gap: var(--crm-spacing-sm);
  padding: 0 var(--crm-spacing-md) var(--crm-spacing-lg);
}
.customers :deep(.van-list > .van-cell) {
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-lg);
  box-shadow: var(--crm-shadow-card);
}
.customers :deep(.van-cell__title > span) {
  color: var(--crm-color-text-primary);
  font-weight: 680;
}
.customers__profile {
  margin-top: 2px;
  color: var(--crm-color-text-primary);
  font-size: 12px;
}
.customers__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 3px 8px;
  color: var(--crm-color-text-tertiary);
  font-size: 11px;
}
.customers__action {
  margin-top: 7px;
  padding-top: 6px;
  border-top: 1px solid var(--crm-color-divider);
  color: var(--crm-color-primary-active);
  font-size: 11px;
}
.customers__action.is-overdue {
  color: var(--van-danger-color);
}
</style>
