<template>
  <div v-loading="loading" class="opp-detail">
    <AppPageHeader
      :title="opp?.name ?? '商机详情'"
      description="跟进、报价、销售计划和成交事实"
      back-to="/opportunities"
      back-label="商机列表"
    >
      <template #actions>
        <template v-if="canOperate">
          <el-button type="primary" @click="commands?.openProgress()">记录商机推进</el-button>
          <el-button type="success" @click="commands?.openWin()">确认成交</el-button>
          <el-button type="danger" plain @click="commands?.openClose()">结案</el-button>
        </template>
      </template>
    </AppPageHeader>

    <el-card v-if="opp" class="opp-detail__card">
      <template #header>商机当前状态</template>
      <el-alert
        v-if="opp.riskFlags?.length"
        type="warning"
        :closable="false"
        show-icon
        class="opp-detail__risk"
      >
        <template #title>
          当前需关注：{{ opp.riskFlags.map((risk) => OPPORTUNITY_RISK_LABELS[risk]).join('、') }}
        </template>
      </el-alert>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">{{ opp.name }}</el-descriptions-item>
        <el-descriptions-item label="阶段">
          <el-tag :type="opportunityStageTag(opp.stage)">{{
            opportunityStageLabel(opp.stage)
          }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="所属客户">
          <el-button link type="primary" @click="router.push(`/customers/${opp.customerId}`)">
            {{ opp.customerName ?? '-' }}
          </el-button>
        </el-descriptions-item>
        <el-descriptions-item label="当前负责人">{{
          opp.currentOwnerName ?? '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="当前参考金额">
          {{ opportunityAmountText(opp.referenceAmount) }} ·
          {{ opportunityAmountBasisLabel(opp.amountBasis) }}
        </el-descriptions-item>
        <el-descriptions-item label="来源">{{ sourceLabel(opp.source) }}</el-descriptions-item>
        <el-descriptions-item label="产品线">{{
          productLineLabel(opp.productLines)
        }}</el-descriptions-item>
        <el-descriptions-item label="金额说明">{{ opp.estimateNote || '-' }}</el-descriptions-item>
        <el-descriptions-item label="需求发现日">{{
          dateText(opp.discoveredDate)
        }}</el-descriptions-item>
        <el-descriptions-item label="预计成交日">{{
          dateText(opp.expectedCloseDate)
        }}</el-descriptions-item>
        <el-descriptions-item label="下一计划">{{
          opp.actions[0]?.content ?? '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="计划时间">{{
          formatTime(opp.actions[0]?.plannedAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="最近报价">{{
          opportunityAmountText(opp.quotes[0]?.amount)
        }}</el-descriptions-item>
        <el-descriptions-item label="报价类型">{{
          opportunityQuoteKindLabel(opp.quotes[0]?.kind)
        }}</el-descriptions-item>
      </el-descriptions>
      <el-descriptions v-if="opp.deal" class="opp-detail__deal" :column="2" border title="成交确认">
        <el-descriptions-item label="成交金额">{{
          opportunityAmountText(opp.deal.amount)
        }}</el-descriptions-item>
        <el-descriptions-item label="成交时间">{{
          formatTime(opp.deal.occurredAt)
        }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="opp" class="opp-detail__card">
      <template #header>报价记录（口头与正式均独立留痕）</template>
      <el-table :data="opp.quotes" border>
        <el-table-column label="时间" width="170"
          ><template #default="{ row }">{{ formatTime(row.quotedAt) }}</template></el-table-column
        >
        <el-table-column label="类型" width="80"
          ><template #default="{ row }">{{
            opportunityQuoteKindLabel(row.kind)
          }}</template></el-table-column
        >
        <el-table-column label="金额" width="130"
          ><template #default="{ row }">{{
            opportunityAmountText(row.amount)
          }}</template></el-table-column
        >
        <el-table-column prop="quoteNo" label="报价单号" />
        <el-table-column label="上一版本" min-width="150">
          <template #default="{ row }">{{ supersedesText(row.supersedesQuoteId) }}</template>
        </el-table-column>
        <el-table-column prop="note" label="说明" min-width="160" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">{{ opportunityQuoteStatusLabel(row.status) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card v-if="opp" class="opp-detail__card">
      <template #header>跟进事实</template>
      <el-timeline>
        <el-timeline-item
          v-for="item in opp.followUps"
          :key="item.id"
          :timestamp="formatTime(item.occurredAt)"
        >
          {{ item.conclusion }}
        </el-timeline-item>
      </el-timeline>
      <el-empty v-if="opp.followUps.length === 0" description="尚无跟进记录" :image-size="60" />
    </el-card>

    <el-card v-if="opp" class="opp-detail__card">
      <template #header>状态事件</template>
      <el-timeline>
        <el-timeline-item
          v-for="event in opp.events"
          :key="event.id"
          :timestamp="formatTime(event.occurredAt)"
        >
          {{ eventText(event) }}
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <OpportunityCommandDialogs v-if="opp" ref="commands" :opportunity="opp" @changed="reload" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  getOpportunity,
  getSalesPlan,
  listDimensionOptions,
  OPPORTUNITY_RISK_LABELS,
  useAuthStore,
  useQuery,
} from '@crm/domain'
import OpportunityCommandDialogs from '../components/opportunities/OpportunityCommandDialogs.vue'
import {
  opportunityAmountText,
  opportunityAmountBasisLabel,
  opportunityQuoteKindLabel,
  opportunityQuoteStatusLabel,
  opportunityStageLabel,
  opportunityStageTag,
} from '../components/opportunities/opportunity-presentation'
import AppPageHeader from '../components/AppPageHeader.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const oppId = route.params.id as string
const {
  data: opp,
  loading,
  reload,
} = useQuery(`opportunity:detail:${oppId}`, () => getOpportunity(oppId))
const { data: sourceOptions } = useQuery('catalog:opportunity_source', () =>
  listDimensionOptions('opportunity_source'),
)
const { data: productLineOptions } = useQuery('catalog:product_line', () =>
  listDimensionOptions('product_line'),
)
const commands = ref<InstanceType<typeof OpportunityCommandDialogs>>()
const routeCommandOpened = ref(false)
const isOpen = computed(() => opp.value?.stage === 'intent' || opp.value?.stage === 'following')
const canOperate = computed(() => isOpen.value && auth.hasAbility('customer.write'))

watch(
  () => opp.value,
  async (value) => {
    if (!value || routeCommandOpened.value) return
    await nextTick()
    if (route.query.executePlan) {
      const plan = await getSalesPlan(route.query.executePlan as string)
      commands.value?.openProgress(plan)
      routeCommandOpened.value = true
      return
    }
    if (route.query.record === 'progress' || route.query.record === 'follow-up') {
      commands.value?.openProgress(undefined, route.query.date as string | undefined)
      routeCommandOpened.value = true
    }
  },
  { immediate: true },
)

function sourceLabel(source: string): string {
  return sourceOptions.value?.find((option) => option.name === source)?.label ?? source
}
function productLineLabel(productLines: string[]): string {
  if (!productLines.length) return '-'
  return productLines
    .map(
      (value) => productLineOptions.value?.find((option) => option.name === value)?.label ?? value,
    )
    .join('、')
}
function formatTime(value: string | undefined | null): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}
function dateText(value: string | undefined | null): string {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '-'
}
function eventText(event: { type: string; payload: unknown }): string {
  const payload = (event.payload ?? {}) as {
    from?: string
    to?: string
    name?: string
    initialAmount?: number
    initialAmountBasis?: 'estimate' | 'oral_quote' | 'formal_quote'
    reason?: string
    quoteId?: string
  }
  if (event.type === 'created')
    return `创建商机：${payload.name ?? ''}，${opportunityAmountBasisLabel(payload.initialAmountBasis)} ${opportunityAmountText(payload.initialAmount?.toString())}`
  if (event.type === 'stage_changed')
    return `阶段：${eventStageLabel(payload.from)} → ${eventStageLabel(payload.to)}${payload.reason ? `（${payload.reason}）` : ''}`
  return payload.quoteId ? '新增报价记录' : '更新商机'
}
function supersedesText(quoteId: string | null): string {
  if (!quoteId) return '首次报价'
  const previous = opp.value?.quotes.find((quote) => quote.id === quoteId)
  return previous
    ? `${opportunityQuoteKindLabel(previous.kind)} ${opportunityAmountText(previous.amount)}`
    : '历史报价'
}
function eventStageLabel(stage: string | undefined): string {
  return opportunityStageLabel(stage)
}
</script>

<style scoped>
.opp-detail {
  padding: var(--crm-spacing-xl);
}
.opp-detail__card {
  width: 100%;
  max-width: none;
  margin-bottom: var(--crm-spacing-lg);
}
.opp-detail__deal {
  margin-top: var(--crm-spacing-md);
}
.opp-detail__risk {
  margin-bottom: var(--crm-spacing-md);
}
</style>
