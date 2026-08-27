<template>
  <div class="complaints">
    <AppPageHeader title="客诉处理" description="未解决与逾期优先，选择客诉后在同页查看完整处理时间线" />

    <div class="complaints__filters">
      <el-input v-model="filters.keyword" clearable placeholder="搜索客户或客诉描述" @input="onKeywordInput" />
      <el-select v-model="filters.status" @change="applyFilters">
        <el-option label="全部状态" value="" />
        <el-option label="处理中" value="registered" />
        <el-option label="已解决" value="resolved" />
      </el-select>
      <el-checkbox v-model="filters.overdue" @change="applyFilters">只看逾期</el-checkbox>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <div class="complaints__workspace">
      <el-card class="complaints__list-card">
        <el-table
          v-if="!error && page?.items.length"
          v-loading="loading"
          :data="page.items"
          :row-class-name="rowClassName"
          highlight-current-row
          @row-click="selectComplaint"
        >
          <el-table-column label="客户 / 客诉" min-width="220">
            <template #default="{ row }">
              <strong>{{ (row as Complaint).customerName ?? '-' }}</strong>
              <div class="complaints__description">{{ (row as Complaint).description }}</div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="82">
            <template #default="{ row }">
              <el-tag :type="statusTag(row as Complaint)" size="small">{{ statusText(row as Complaint) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="当前行动" min-width="180">
            <template #default="{ row }">
              <div>{{ (row as Complaint).currentAction?.content ?? '-' }}</div>
              <small :class="{ 'is-overdue': isOverdue(row as Complaint) }">
                {{ timeText((row as Complaint).currentAction?.plannedAt) }}
              </small>
            </template>
          </el-table-column>
        </el-table>
        <AppQueryState :error="error" :empty="!loading && !page?.items.length" empty-text="暂无符合条件的客诉" @retry="reload" />
        <el-pagination
          v-if="page?.total"
          v-model:current-page="pageNum"
          :page-size="PAGE_SIZE"
          :total="page.total"
          layout="prev, pager, next, total"
          class="complaints__pagination"
          @current-change="loadPage"
        />
      </el-card>

      <el-card class="complaints__detail-card">
        <ComplaintDetailPage v-if="selectedId" :key="selectedId" :complaint-id="selectedId" embedded @changed="reload" />
        <el-empty v-else description="选择一条客诉查看处理时间线" />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { listComplaints, useQuery, type Complaint, type ComplaintListQuery } from '@crm/domain'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import ComplaintDetailPage from './ComplaintDetailPage.vue'

const route = useRoute()
const router = useRouter()
const PAGE_SIZE = 20
const pageNum = ref(1)
const filters = reactive({ keyword: '', status: 'registered' as '' | 'registered' | 'resolved', overdue: false })
const query = ref<ComplaintListQuery>({ status: 'registered', page: 1, pageSize: PAGE_SIZE })
const selectedId = computed(() => String(route.query.selected ?? ''))
const { data: page, loading, error, reload } = useQuery('complaints:list', () => listComplaints(query.value))

watch(page, (value) => {
  if (!value?.items.length) return
  if (!value.items.some((item) => item.id === selectedId.value)) void setSelected(value.items[0].id)
}, { immediate: true })

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(applyFilters, 300)
}
function applyFilters() {
  pageNum.value = 1
  query.value = {
    keyword: filters.keyword.trim() || undefined,
    status: filters.status || undefined,
    overdue: filters.overdue || undefined,
    page: 1,
    pageSize: PAGE_SIZE,
  }
  void reload()
}
function resetFilters() {
  Object.assign(filters, { keyword: '', status: 'registered', overdue: false })
  applyFilters()
}
function loadPage() {
  query.value = { ...query.value, page: pageNum.value }
  void reload()
}
function selectComplaint(row: Complaint) {
  void setSelected(row.id)
}
function setSelected(id: string) {
  return router.replace({ query: { ...route.query, selected: id } })
}
function isOverdue(complaint: Complaint): boolean {
  return Boolean(complaint.status === 'registered' && complaint.currentAction && new Date(complaint.currentAction.plannedAt).getTime() < Date.now())
}
function statusText(complaint: Complaint): string {
  if (complaint.status === 'resolved') return '已解决'
  return isOverdue(complaint) ? '已逾期' : '处理中'
}
function statusTag(complaint: Complaint): 'success' | 'danger' | 'warning' {
  if (complaint.status === 'resolved') return 'success'
  return isOverdue(complaint) ? 'danger' : 'warning'
}
function timeText(value: string | undefined): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}
function rowClassName({ row }: { row: Complaint }): string {
  return row.id === selectedId.value ? 'is-selected' : ''
}
</script>

<style scoped>
.complaints { padding: var(--crm-spacing-xl); }
.complaints__filters {
  display: grid;
  grid-template-columns: minmax(240px, 1fr) 150px auto auto;
  gap: var(--crm-spacing-sm);
  align-items: center;
  margin-bottom: var(--crm-spacing-md);
}
.complaints__workspace {
  display: grid;
  grid-template-columns: minmax(520px, 0.9fr) minmax(560px, 1.1fr);
  gap: var(--crm-spacing-lg);
  align-items: start;
}
.complaints__list-card, .complaints__detail-card { width: 100%; max-width: none; }
.complaints__detail-card { min-height: 420px; }
.complaints__description { margin-top: 3px; color: var(--crm-color-text-secondary); font-size: var(--crm-font-size-sm); }
.complaints small { color: var(--crm-color-text-secondary); }
.complaints .is-overdue { color: var(--crm-color-danger); font-weight: 600; }
.complaints__pagination { justify-content: flex-end; margin-top: var(--crm-spacing-md); }
:deep(.el-table__row) { cursor: pointer; }
:deep(.el-table__row.is-selected > td) { background: var(--crm-color-primary-light) !important; }
@media (max-width: 1280px) { .complaints__workspace { grid-template-columns: 1fr; } }
</style>
