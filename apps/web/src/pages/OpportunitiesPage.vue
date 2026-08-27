<template>
  <div class="opps">
    <AppPageHeader title="商机管理" description="看清有效意向、最近推进和下一步计划">
      <template #actions>
        <el-button
          v-if="auth.hasAbility('customer.write')"
          type="primary"
          @click="createDialog?.open()"
        >
          新建商机
        </el-button>
      </template>
    </AppPageHeader>

    <el-card class="opps__card">
      <div class="opps__filters">
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索客户或商机"
          @input="onKeywordInput"
        />
        <el-select v-model="filters.stage" clearable placeholder="全部阶段" @change="applyFilters">
          <el-option
            v-for="stage in OPPORTUNITY_STAGE_OPTIONS"
            :key="stage.value"
            :label="stage.label"
            :value="stage.value"
          />
        </el-select>
        <el-select v-model="filters.quote" placeholder="报价情况" @change="applyFilters">
          <el-option label="全部报价情况" value="all" />
          <el-option label="已有报价" value="yes" />
          <el-option label="尚未报价" value="no" />
        </el-select>
        <el-select v-model="filters.action" placeholder="计划情况" @change="applyFilters">
          <el-option label="全部计划情况" value="all" />
          <el-option label="缺少下一计划" value="missing" />
        </el-select>
        <el-select v-model="filters.risk" placeholder="推进状态" @change="applyFilters">
          <el-option label="全部推进状态" value="all" />
          <el-option label="存在停滞风险" value="stagnant" />
          <el-option label="推进正常" value="healthy" />
        </el-select>
        <div class="opps__amount-filter">
          <el-input-number
            v-model="filters.minAmount"
            :min="0"
            :controls="false"
            placeholder="最低金额"
            @change="applyFilters"
          />
          <span>—</span>
          <el-input-number
            v-model="filters.maxAmount"
            :min="0"
            :controls="false"
            placeholder="最高金额"
            @change="applyFilters"
          />
        </div>
        <el-button @click="resetFilters">重置</el-button>
      </div>

      <el-table
        v-if="!error && page?.items.length"
        v-loading="loading"
        :data="page.items"
        border
        row-class-name="opps__row"
        @row-click="(row: Opportunity) => router.push(`/opportunities/${row.id}`)"
      >
        <el-table-column label="客户 / 商机" min-width="220" fixed>
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              class="opps__customer"
              @click.stop="void router.push(`/customers/${(row as Opportunity).customerId}`)"
            >
              {{ (row as Opportunity).customerName ?? '-' }}
            </el-button>
            <div class="opps__opportunity-name">{{ (row as Opportunity).name }}</div>
          </template>
        </el-table-column>

        <el-table-column label="阶段" width="100">
          <template #default="{ row }">
            <div class="opps__tags">
              <el-tag :type="opportunityStageTag((row as Opportunity).stage)">
                {{ opportunityStageLabel((row as Opportunity).stage) }}
              </el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="推进状态" min-width="150">
          <template #default="{ row }">
            <el-tag v-if="(row as Opportunity).riskFlags?.length" type="warning" effect="plain">
              需处理 · {{ primaryAttention(row as Opportunity) }}
              <template v-if="((row as Opportunity).riskFlags?.length ?? 0) > 1">
                +{{ ((row as Opportunity).riskFlags?.length ?? 1) - 1 }}
              </template>
            </el-tag>
            <el-tag v-else type="success" effect="plain">推进正常</el-tag>
          </template>
        </el-table-column>

        <el-table-column label="意向规模" width="130" align="right">
          <template #default="{ row }">
            <span>{{ opportunityAmountText((row as Opportunity).estimatedAmount) }}</span>
            <span v-if="(row as Opportunity).approximate" class="opps__muted">（约）</span>
          </template>
        </el-table-column>

        <el-table-column label="最近报价" min-width="170">
          <template #default="{ row }">
            <template v-if="(row as Opportunity).latestQuote">
              <div>{{ opportunityAmountText((row as Opportunity).latestQuote?.amount) }}</div>
              <div class="opps__muted">
                {{ opportunityQuoteKindLabel((row as Opportunity).latestQuote?.kind) }} ·
                {{ dateText((row as Opportunity).latestQuote?.quotedAt) }}
              </div>
            </template>
            <span v-else class="opps__muted">尚未报价</span>
          </template>
        </el-table-column>

        <el-table-column label="最近跟进" min-width="200">
          <template #default="{ row }">
            <template v-if="(row as Opportunity).latestFollowUp">
              <div class="opps__ellipsis">
                {{ (row as Opportunity).latestFollowUp?.conclusion }}
              </div>
              <div class="opps__muted">
                {{ dateText((row as Opportunity).latestFollowUp?.occurredAt) }}
              </div>
            </template>
            <span v-else class="opps__muted">尚无跟进</span>
          </template>
        </el-table-column>

        <el-table-column label="当前计划" min-width="210">
          <template #default="{ row }">
            <template v-if="(row as Opportunity).currentAction">
              <div class="opps__ellipsis">{{ (row as Opportunity).currentAction?.content }}</div>
              <div
                :class="[
                  'opps__muted',
                  { opps__overdue: isActionOverdue((row as Opportunity).currentAction) },
                ]"
              >
                {{ timeText((row as Opportunity).currentAction?.plannedAt) }}
              </div>
            </template>
            <span v-else class="opps__muted">无下一计划</span>
          </template>
        </el-table-column>

        <el-table-column label="负责人" width="110">
          <template #default="{ row }">
            {{ (row as Opportunity).currentOwnerName ?? '-' }}
          </template>
        </el-table-column>
      </el-table>

      <AppQueryState
        :error="error"
        :empty="!loading && !page?.items.length"
        empty-text="没有符合条件的商机"
        @retry="reload"
      />
      <el-pagination
        v-if="page?.total"
        v-model:current-page="pageNum"
        :page-size="PAGE_SIZE"
        :total="page.total"
        layout="prev, pager, next, total"
        class="opps__pagination"
        @current-change="loadPage"
      />
    </el-card>

    <OpportunityCreateDialog ref="createDialog" @created="openCreatedOpportunity" />
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import OpportunityCreateDialog from '../components/opportunities/OpportunityCreateDialog.vue'
import {
  opportunityAmountText,
  opportunityQuoteKindLabel,
  opportunityStageLabel,
  opportunityStageTag,
} from '../components/opportunities/opportunity-presentation'
import {
  useAuthStore,
  useQuery,
  listOpportunities,
  OPPORTUNITY_RISK_LABELS,
  OPPORTUNITY_STAGE_OPTIONS,
  type FollowUpAction,
  type Opportunity,
  type OpportunityListQuery,
  type OpportunityStage,
  type OpportunityRiskFlag,
} from '@crm/domain'

const router = useRouter()
const auth = useAuthStore()
const PAGE_SIZE = 20
const pageNum = ref(1)
const createDialog = ref<InstanceType<typeof OpportunityCreateDialog>>()
const filters = reactive({
  keyword: '',
  stage: '' as OpportunityStage | '',
  quote: 'all' as 'all' | 'yes' | 'no',
  action: 'all' as 'all' | 'missing',
  risk: 'all' as 'all' | 'stagnant' | 'healthy',
  minAmount: undefined as number | undefined,
  maxAmount: undefined as number | undefined,
})

const query = ref<OpportunityListQuery>({ page: 1, pageSize: PAGE_SIZE })

function primaryAttention(opportunity: Opportunity): string {
  const priority: OpportunityRiskFlag[] = [
    'no_pending_action',
    'action_overdue',
    'inactive_30d',
    'expected_close_overdue',
  ]
  const primary = priority.find((item) => opportunity.riskFlags?.includes(item))
  return primary ? OPPORTUNITY_RISK_LABELS[primary] : '需关注'
}
const {
  data: page,
  loading,
  error,
  reload,
} = useQuery('opportunities:list', () => listOpportunities(query.value))

let searchTimer: ReturnType<typeof setTimeout> | undefined
function onKeywordInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(applyFilters, 300)
}

function applyFilters() {
  if (
    filters.minAmount !== undefined &&
    filters.maxAmount !== undefined &&
    filters.minAmount > filters.maxAmount
  ) {
    ElMessage.warning('最低金额不能高于最高金额')
    return
  }
  pageNum.value = 1
  query.value = {
    page: 1,
    pageSize: PAGE_SIZE,
    keyword: filters.keyword.trim() || undefined,
    stage: filters.stage || undefined,
    minAmount: filters.minAmount,
    maxAmount: filters.maxAmount,
    hasQuote: filters.quote === 'all' ? undefined : filters.quote === 'yes',
    noNextAction: filters.action === 'missing' ? true : undefined,
    stagnant: filters.risk === 'all' ? undefined : filters.risk === 'stagnant',
  }
  void reload()
}

function resetFilters() {
  Object.assign(filters, {
    keyword: '',
    stage: '',
    quote: 'all',
    action: 'all',
    risk: 'all',
    minAmount: undefined,
    maxAmount: undefined,
  })
  applyFilters()
}

function loadPage() {
  query.value = { ...query.value, page: pageNum.value }
  void reload()
}

function openCreatedOpportunity(id: string) {
  void router.push(`/opportunities/${id}`)
}

function dateText(value: string | undefined): string {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '-'
}

function timeText(value: string | undefined): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}

function isActionOverdue(action: FollowUpAction | null | undefined): boolean {
  return Boolean(action && new Date(action.plannedAt).getTime() < Date.now())
}
</script>

<style scoped>
.opps {
  padding: var(--crm-spacing-xl);
}
.opps__card {
  width: 100%;
  max-width: none;
}
.opps__filters {
  display: grid;
  grid-template-columns:
    minmax(180px, 1.5fr) repeat(4, minmax(120px, 1fr)) minmax(250px, 1.5fr)
    auto;
  gap: var(--crm-spacing-sm);
  align-items: center;
  margin-bottom: var(--crm-spacing-md);
}
.opps__amount-filter {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-xs);
}
.opps__amount-filter :deep(.el-input-number) {
  width: 112px;
}
.opps__customer {
  justify-content: flex-start;
  max-width: 100%;
  padding: 0;
}
.opps__opportunity-name {
  margin-top: 3px;
  color: var(--crm-color-text-primary);
  font-weight: 600;
}
.opps__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.opps__muted {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
}
.opps__overdue {
  color: var(--el-color-danger);
  font-weight: 600;
}
.opps__ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.opps__pagination {
  justify-content: flex-end;
  margin-top: var(--crm-spacing-md);
}
:deep(.opps__row) {
  cursor: pointer;
}
@media (max-width: 1440px) {
  .opps__filters {
    grid-template-columns: repeat(4, minmax(140px, 1fr));
  }
}
</style>
