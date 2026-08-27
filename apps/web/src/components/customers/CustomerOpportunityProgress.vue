<template>
  <el-card class="opportunity-progress">
    <template #header>
      <div class="opportunity-progress__header">
        <div>
          <strong>商机进展</strong>
          <div class="opportunity-progress__hint">从发现需求到当前计划，按业务节点查看</div>
        </div>
        <el-button v-if="canCreate" type="primary" @click="$emit('create')">新建商机</el-button>
      </div>
    </template>
    <el-empty v-if="!opportunities.length" description="当前没有商机" :image-size="70" />
    <div v-else class="opportunity-progress__list">
      <article
        v-for="opportunity in sortedOpportunities"
        :key="opportunity.id"
        class="opportunity-card"
        @click="router.push(`/opportunities/${opportunity.id}`)"
      >
        <div class="opportunity-card__top">
          <div>
            <strong>{{ opportunity.name }}</strong>
            <span class="opportunity-card__amount">{{
              amountText(opportunity.estimatedAmount)
            }}</span>
          </div>
          <el-tag :type="opportunityStageTag(opportunity.stage)">
            {{ opportunityStageLabel(opportunity.stage) }}
          </el-tag>
        </div>
        <div class="opportunity-card__track">
          <div class="progress-node progress-node--done">
            <span class="progress-node__dot" />
            <strong>发现需求</strong>
            <small>{{ dateText(opportunity.discoveredDate ?? opportunity.createdAt) }}</small>
          </div>
          <div class="progress-node" :class="{ 'progress-node--done': opportunity.latestFollowUp }">
            <span class="progress-node__dot" />
            <strong>最近跟进</strong>
            <small>{{ opportunity.latestFollowUp?.conclusion ?? '尚无跟进' }}</small>
          </div>
          <div class="progress-node" :class="{ 'progress-node--done': opportunity.latestQuote }">
            <span class="progress-node__dot" />
            <strong>最近报价</strong>
            <small>{{ amountText(opportunity.latestQuote?.amount) }}</small>
          </div>
          <div
            class="progress-node"
            :class="{
              'progress-node--attention': !opportunity.currentAction && isOpen(opportunity),
            }"
          >
            <span class="progress-node__dot" />
            <strong>{{ isOpen(opportunity) ? '下一步' : '结果' }}</strong>
            <small>{{ opportunity.currentAction?.content ?? terminalText(opportunity) }}</small>
          </div>
        </div>
        <div v-if="opportunity.riskFlags?.length" class="opportunity-card__attention">
          需处理：{{ primaryAttention(opportunity.riskFlags) }}
          <span v-if="opportunity.riskFlags.length > 1"
            >，另有 {{ opportunity.riskFlags.length - 1 }} 项</span
          >
        </div>
      </article>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  OPPORTUNITY_RISK_LABELS,
  type CustomerOpportunitySummary,
  type OpportunityRiskFlag,
} from '@crm/domain'
import {
  opportunityAmountText,
  opportunityStageLabel,
  opportunityStageTag,
} from '../opportunities/opportunity-presentation'

const props = defineProps<{ opportunities: CustomerOpportunitySummary[]; canCreate?: boolean }>()
defineEmits<{ create: [] }>()
const router = useRouter()
const sortedOpportunities = computed(() =>
  [...props.opportunities].sort((a, b) => Number(isOpen(b)) - Number(isOpen(a))),
)
function isOpen(opportunity: CustomerOpportunitySummary) {
  return opportunity.stage === 'intent' || opportunity.stage === 'following'
}
function amountText(amount?: string | null) {
  return opportunityAmountText(amount)
}
function dateText(value?: string | null) {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '-'
}
function terminalText(opportunity: CustomerOpportunitySummary) {
  if (opportunity.stage === 'won') return '已转订单'
  if (opportunity.stage === 'lost') return '丢单'
  if (opportunity.stage === 'demand_disappeared') return '需求消失'
  return '缺少下一步计划'
}
function primaryAttention(flags: OpportunityRiskFlag[]) {
  const priority: OpportunityRiskFlag[] = [
    'no_pending_action',
    'action_overdue',
    'inactive_30d',
    'expected_close_overdue',
  ]
  const primary = priority.find((item) => flags.includes(item)) ?? flags[0]
  return OPPORTUNITY_RISK_LABELS[primary]
}
</script>

<style scoped>
.opportunity-progress,
.opportunity-card {
  width: 100%;
}
.opportunity-progress__header,
.opportunity-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
}
.opportunity-progress__hint,
.opportunity-card__amount,
.progress-node small {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.opportunity-progress__list {
  display: grid;
  gap: var(--crm-spacing-md);
}
.opportunity-card {
  padding: var(--crm-spacing-md);
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  cursor: pointer;
}
.opportunity-card:hover {
  border-color: var(--crm-color-primary);
}
.opportunity-card__amount {
  margin-left: var(--crm-spacing-sm);
}
.opportunity-card__track {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--crm-spacing-sm);
  margin-top: var(--crm-spacing-md);
}
.progress-node {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 8px 8px 8px 18px;
  background: var(--crm-color-bg-page);
  border-radius: var(--crm-radius-sm);
}
.progress-node__dot {
  position: absolute;
  top: 13px;
  left: 7px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--crm-color-text-secondary);
}
.progress-node--done .progress-node__dot {
  background: var(--crm-color-primary);
}
.progress-node--attention {
  background: #fff7e6;
}
.progress-node--attention .progress-node__dot {
  background: var(--el-color-warning);
}
.opportunity-card__attention {
  margin-top: var(--crm-spacing-sm);
  color: var(--el-color-warning-dark-2);
  font-size: var(--crm-font-size-xs);
}
</style>
