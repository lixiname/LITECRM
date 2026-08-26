<template>
  <div v-loading="loading" class="opp-detail">
    <AppPageHeader
      :title="opp?.name ?? '商机详情'"
      description="跟进、报价、行动和成交事实"
      back-to="/opportunities"
      back-label="商机列表"
    >
      <template #actions>
        <template v-if="isOpen">
          <el-button @click="commands?.openFollow()">记跟进</el-button>
          <el-button @click="commands?.openQuote()">记报价</el-button>
          <el-button type="success" @click="commands?.openWin()">确认成交</el-button>
          <el-button type="danger" plain @click="commands?.openClose()">结案</el-button>
        </template>
      </template>
    </AppPageHeader>

    <el-card v-if="opp" class="opp-detail__card">
      <template #header>商机当前状态</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">{{ opp.name }}</el-descriptions-item>
        <el-descriptions-item label="阶段">
          <el-tag :type="stageTag(opp.stage)">{{ stageLabel(opp.stage) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="意向规模">{{
          amountText(opp.estimatedAmount)
        }}</el-descriptions-item>
        <el-descriptions-item label="来源">{{ sourceLabel(opp.source) }}</el-descriptions-item>
        <el-descriptions-item label="下一行动">{{
          opp.actions[0]?.content ?? '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="计划时间">{{
          formatTime(opp.actions[0]?.plannedAt)
        }}</el-descriptions-item>
        <el-descriptions-item label="最近报价">{{
          amountText(opp.quotes[0]?.amount)
        }}</el-descriptions-item>
        <el-descriptions-item label="报价类型">{{
          quoteKindLabel(opp.quotes[0]?.kind)
        }}</el-descriptions-item>
      </el-descriptions>
      <el-descriptions v-if="opp.deal" class="opp-detail__deal" :column="2" border title="成交确认">
        <el-descriptions-item label="成交金额">{{
          amountText(opp.deal.amount)
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
          ><template #default="{ row }">{{ quoteKindLabel(row.kind) }}</template></el-table-column
        >
        <el-table-column label="金额" width="130"
          ><template #default="{ row }">{{ amountText(row.amount) }}</template></el-table-column
        >
        <el-table-column prop="quoteNo" label="报价单号" />
        <el-table-column prop="status" label="状态" width="100" />
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
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import {
  getOpportunity,
  OPPORTUNITY_SOURCE_OPTIONS,
  OPPORTUNITY_STAGE_OPTIONS,
  useQuery,
  type OpportunityQuote,
  type OpportunityStage,
} from '@crm/domain'
import OpportunityCommandDialogs from '../components/opportunities/OpportunityCommandDialogs.vue'
import AppPageHeader from '../components/AppPageHeader.vue'

const route = useRoute()
const oppId = route.params.id as string
const {
  data: opp,
  loading,
  reload,
} = useQuery(`opportunity:detail:${oppId}`, () => getOpportunity(oppId))
const commands = ref<InstanceType<typeof OpportunityCommandDialogs>>()
const isOpen = computed(() => opp.value?.stage === 'intent' || opp.value?.stage === 'following')

function stageTag(stage: OpportunityStage): 'success' | 'warning' | 'info' | 'danger' {
  return stage === 'won'
    ? 'success'
    : stage === 'lost' || stage === 'demand_disappeared'
      ? 'danger'
      : stage === 'following'
        ? 'warning'
        : 'info'
}
function stageLabel(stage: OpportunityStage): string {
  return OPPORTUNITY_STAGE_OPTIONS.find((item) => item.value === stage)?.label ?? stage
}
function sourceLabel(source: string): string {
  return OPPORTUNITY_SOURCE_OPTIONS.find((item) => item.value === source)?.label ?? source
}
function quoteKindLabel(kind: OpportunityQuote['kind'] | undefined): string {
  return kind ? (kind === 'formal' ? '正式报价' : '口头报价') : '-'
}
function amountText(amount: string | undefined | null): string {
  return amount == null ? '-' : `¥${Number(amount).toLocaleString()}`
}
function formatTime(value: string | undefined | null): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}
function eventText(event: { type: string; payload: unknown }): string {
  const payload = (event.payload ?? {}) as {
    from?: string
    to?: string
    name?: string
    estimatedAmount?: number
    reason?: string
    quoteId?: string
  }
  if (event.type === 'created')
    return `创建商机：${payload.name ?? ''}，意向规模 ${amountText(payload.estimatedAmount?.toString())}`
  if (event.type === 'stage_changed')
    return `阶段：${payload.from ?? '-'} → ${payload.to ?? '-'}${payload.reason ? `（${payload.reason}）` : ''}`
  return payload.quoteId ? '新增报价记录' : '更新商机'
}
</script>

<style scoped>
.opp-detail {
  padding: var(--crm-spacing-xl);
}
.opp-detail__card {
  max-width: 920px;
  margin-bottom: var(--crm-spacing-lg);
}
.opp-detail__deal {
  margin-top: var(--crm-spacing-md);
}
</style>
