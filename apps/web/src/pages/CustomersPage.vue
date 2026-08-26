<template>
  <div class="customers">
    <AppPageHeader title="客户管理" description="按名称、地区、等级和状态查找客户">
      <template #actions>
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
          v-model="filters.status"
          placeholder="状态"
          clearable
          style="width: 110px"
          @change="load"
        >
          <el-option
            v-for="s in CUSTOMER_STATUS_OPTIONS"
            :key="s.value"
            :label="s.label"
            :value="s.value"
          />
        </el-select>
        <el-button
          v-if="auth.hasAbility('customer.write')"
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
        <el-table-column prop="name" label="名称" min-width="180" />
        <el-table-column prop="city" label="城市" width="100" />
        <el-table-column label="等级" width="70">
          <template #default="{ row }">{{ (row as CustomerItem).grade }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="statusTag((row as CustomerItem).status)">
              {{ statusLabel((row as CustomerItem).status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="负责人" width="90">
          <template #default="{ row }">
            {{ (row as CustomerItem).ownerId === auth.user?.id ? '我' : '他人' }}
          </template>
        </el-table-column>
        <el-table-column label="最近活动" width="170">
          <template #default="{ row }">
            {{ activityTime((row as CustomerItem).lastActivityAt) }}
          </template>
        </el-table-column>
      </el-table>
      <AppQueryState
        :error="error"
        :empty="!loading && !page?.items.length"
        empty-text="还没有客户；可以先新建一位客户"
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
import { reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import {
  useAuthStore,
  useQuery,
  listCustomers,
  CUSTOMER_GRADE_OPTIONS,
  CUSTOMER_STATUS_OPTIONS,
  type CustomerItem,
  type CustomerStatus,
} from '@crm/domain'

const router = useRouter()
const auth = useAuthStore()
const PAGE_SIZE = 20

const keyword = ref('')
const filters = reactive<{ grade?: string; status?: string }>({})
const pageNum = ref(1)
const query = ref({
  page: 1,
  pageSize: PAGE_SIZE,
  keyword: '',
  grade: undefined as string | undefined,
  status: undefined as string | undefined,
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
  query.value = { ...query.value, grade: filters.grade, status: filters.status, page: 1 }
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
function activityTime(value?: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
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
</style>
