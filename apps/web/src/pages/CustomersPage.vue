<template>
  <div class="customers">
    <AppPageHeader :title="pageTitle" :description="pageDescription">
      <template #actions>
        <el-segmented v-model="filters.status" :options="poolOptions" @change="load" />
        <el-input
          v-model="keyword"
          placeholder="搜索名称/城市"
          clearable
          style="width: 220px"
          @input="onSearch"
        />
        <el-select
          v-model="filters.grade"
          placeholder="等级"
          clearable
          style="width: 100px"
          @change="load"
        >
          <el-option v-for="g in CUSTOMER_GRADE_OPTIONS" :key="g" :label="g" :value="g" />
        </el-select>
        <el-select
          v-model="filters.relationshipStage"
          placeholder="经营阶段"
          clearable
          style="width: 130px"
        >
          <el-option
            v-for="item in CUSTOMER_RELATIONSHIP_STAGE_OPTIONS"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-button
          v-if="auth.hasAbility('customer.write') && filters.status === 'active'"
          type="primary"
          @click="router.push('/customers/new')"
        >
          新建客户
        </el-button>
      </template>
    </AppPageHeader>

    <el-card class="customers__card">
      <el-table
        v-if="!error && page?.items.length"
        v-loading="loading"
        :data="page?.items ?? []"
        border
        @row-click="(row: CustomerItem) => router.push(`/customers/${row.id}`)"
      >
        <el-table-column label="客户" min-width="220">
          <template #default="{ row }">
            <div class="customers__name">{{ (row as CustomerItem).name }}</div>
            <div class="customers__meta">
              <span>{{ locationText(row as CustomerItem) }}</span>
              <el-tag size="small" effect="plain" :type="statusTag((row as CustomerItem).status)">
                {{ statusLabel((row as CustomerItem).status) }}
              </el-tag>
              <el-tag size="small" effect="plain">
                {{ relationshipLabel((row as CustomerItem).relationshipStage) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="业务画像" min-width="170">
          <template #default="{ row }">
            {{ businessProfile(row as CustomerItem) }}
          </template>
        </el-table-column>
        <el-table-column label="等级" width="70">
          <template #default="{ row }">{{ (row as CustomerItem).grade }}</template>
        </el-table-column>
        <el-table-column label="有效商机" min-width="150">
          <template #default="{ row }">
            <div v-if="(row as CustomerItem).openOpportunityCount" class="customers__stack">
              <span>{{ opportunityText(row as CustomerItem) }}</span>
              <span class="customers__muted">{{
                moneyText((row as CustomerItem).openOpportunityAmount)
              }}</span>
            </div>
            <span v-else class="customers__muted">暂无有效商机</span>
          </template>
        </el-table-column>
        <el-table-column label="最近活动" width="130">
          <template #default="{ row }">
            {{ activityTime((row as CustomerItem).lastActivityAt) }}
          </template>
        </el-table-column>
        <el-table-column label="下一步" min-width="190">
          <template #default="{ row }">
            <div v-if="(row as CustomerItem).nextActionAt" class="customers__stack">
              <span :class="{ customers__overdue: isOverdue((row as CustomerItem).nextActionAt) }">
                {{ actionTime((row as CustomerItem).nextActionAt) }}
              </span>
              <span class="customers__muted customers__ellipsis">
                {{ (row as CustomerItem).nextActionContent }}
              </span>
            </div>
            <span v-else class="customers__muted">未安排</span>
          </template>
        </el-table-column>
        <el-table-column v-if="showOwner" label="负责人" width="110">
          <template #default="{ row }">
            {{ (row as CustomerItem).ownerName ?? '未分配' }}
          </template>
        </el-table-column>
      </el-table>
      <AppQueryState
        :error="error"
        :empty="!loading && !page?.items.length"
        :empty-text="emptyText"
        @retry="reload"
      />
      <el-pagination
        v-if="page?.total"
        v-model:current-page="pageNum"
        :page-size="PAGE_SIZE"
        :total="page?.total ?? 0"
        layout="prev, pager, next, total"
        class="customers__pagination"
        @current-change="load"
      />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import {
  useAuthStore,
  useQuery,
  listCustomers,
  listDimensionOptions,
  CUSTOMER_GRADE_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_RELATIONSHIP_STAGE_OPTIONS,
  type CustomerItem,
  type CustomerStatus,
  type CustomerRelationshipStage,
  type DimensionOption,
} from '@crm/domain'

const router = useRouter()
const auth = useAuthStore()
const PAGE_SIZE = 20
const showOwner = computed(() => auth.user?.role !== 'sales')
const poolOptions = computed(() => {
  const options = [{ label: '在案客户', value: 'active' }]
  if (
    auth.user?.role === 'sales' ||
    auth.user?.role === 'executive' ||
    auth.user?.role === 'admin'
  ) {
    options.push({ label: '公海池', value: 'public' })
  }
  if (auth.user?.role === 'executive' || auth.user?.role === 'admin') {
    options.push({ label: '无效档案', value: 'invalid' })
  }
  return options
})
const pageTitle = computed(() =>
  filters.status === 'public' ? '公海客户' : filters.status === 'invalid' ? '无效档案' : '客户管理',
)
const pageDescription = computed(() =>
  filters.status === 'public'
    ? '检索本销售区域内暂无负责人的有效客户'
    : filters.status === 'invalid'
      ? '查看已停止经营、仍保留历史记录的客户档案'
      : '查看本人或团队正在经营的客户',
)
const emptyText = computed(() =>
  filters.status === 'public'
    ? '当前销售区域暂无公海客户'
    : filters.status === 'invalid'
      ? '当前范围内暂无无效档案'
      : '还没有在案客户；可以先新建一位客户',
)
const dimensionLabels = ref<Record<string, string>>({})

onMounted(async () => {
  const groups = await Promise.all([
    listDimensionOptions('industry').catch(() => [] as DimensionOption[]),
    listDimensionOptions('sub_industry').catch(() => [] as DimensionOption[]),
  ])
  for (const options of groups) {
    for (const option of options) {
      dimensionLabels.value[`${option.dimension}:${option.name}`] = option.label
    }
  }
})

const keyword = ref('')
const filters = reactive<{
  grade?: string
  status: CustomerStatus
  relationshipStage?: CustomerRelationshipStage
}>({ status: 'active' })
const pageNum = ref(1)
const query = ref({
  page: 1,
  pageSize: PAGE_SIZE,
  keyword: '',
  grade: undefined as string | undefined,
  status: 'active' as CustomerStatus,
  relationshipStage: undefined as CustomerRelationshipStage | undefined,
})

const {
  data: page,
  loading,
  error,
  reload,
} = useQuery('customers:list', () => listCustomers(query.value))

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    query.value = { ...query.value, keyword: keyword.value.trim(), page: 1 }
    pageNum.value = 1
    void reload()
  }, 300)
}

watch(filters, () => {
  query.value = {
    ...query.value,
    grade: filters.grade,
    status: filters.status,
    relationshipStage: filters.relationshipStage,
    page: 1,
  }
  pageNum.value = 1
  void reload()
})

function load() {
  query.value = { ...query.value, page: pageNum.value }
  void reload()
}

function statusTag(status: CustomerStatus): 'success' | 'warning' | 'info' {
  return status === 'active' ? 'success' : status === 'public' ? 'warning' : 'info'
}
function statusLabel(status: CustomerStatus): string {
  return CUSTOMER_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}
function relationshipLabel(stage: CustomerRelationshipStage): string {
  return CUSTOMER_RELATIONSHIP_STAGE_OPTIONS.find((item) => item.value === stage)?.label ?? stage
}
function activityTime(value?: string | null): string {
  if (!value) return '暂无活动'
  const days = Math.floor((Date.now() - new Date(value).getTime()) / 86_400_000)
  if (days <= 0) return '今天'
  if (days === 1) return '昨天'
  return `${days} 天前`
}
function locationText(customer: CustomerItem): string {
  return [customer.salesRegionName, customer.city].filter(Boolean).join(' · ') || '地区待完善'
}
function dimensionLabel(dimension: string, value?: string | null): string {
  if (!value) return ''
  return dimensionLabels.value[`${dimension}:${value}`] ?? value
}
function businessProfile(customer: CustomerItem): string {
  return (
    [
      dimensionLabel('industry', customer.industry),
      dimensionLabel('sub_industry', customer.subIndustry),
    ]
      .filter(Boolean)
      .join(' · ') || '业务画像待完善'
  )
}
function opportunityText(customer: CustomerItem): string {
  const stage = customer.activeOpportunityStage === 'following' ? '跟进中' : '意向'
  return `${stage} · ${customer.openOpportunityCount ?? 0} 个`
}
function moneyText(value?: string | null): string {
  const amount = Number(value ?? 0)
  return amount > 0 ? `预计 ¥${amount.toLocaleString()}` : '金额待补充'
}
function actionTime(value?: string | null): string {
  if (!value) return '-'
  const date = new Date(value)
  return `${isOverdue(value) ? '已逾期 · ' : ''}${date.toLocaleDateString('zh-CN')}`
}
function isOverdue(value?: string | null): boolean {
  return Boolean(value && new Date(value).getTime() < Date.now())
}
</script>

<style scoped>
.customers {
  padding: var(--crm-spacing-xl);
}
.customers__pagination {
  margin-top: var(--crm-spacing-md);
  justify-content: flex-end;
}
.customers__name {
  font-weight: 600;
  color: var(--crm-color-text-primary);
}
.customers__meta,
.customers__stack {
  display: flex;
  gap: var(--crm-spacing-xs);
}
.customers__meta {
  align-items: center;
  margin-top: 4px;
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.customers__stack {
  flex-direction: column;
}
.customers__muted {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.customers__overdue {
  color: var(--el-color-danger);
  font-weight: 600;
}
.customers__ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
