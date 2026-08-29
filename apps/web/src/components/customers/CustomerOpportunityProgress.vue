<template>
  <el-card class="opportunity-progress">
    <template #header>
      <div>
        <strong>商机进展</strong>
        <div class="opportunity-progress__hint">从发现需求到当前计划，按业务节点查看</div>
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
            <span class="opportunity-card__amount"
              >{{ amountText(opportunity.referenceAmount) }} ·
              {{ opportunityAmountBasisLabel(opportunity.amountBasis) }}</span
            >
          </div>
          <el-tag :type="opportunityStageTag(opportunity.stage)">
            {{ opportunityStageLabel(opportunity.stage) }}
          </el-tag>
        </div>
        <div class="opportunity-card__activity">
          <div v-for="item in opportunity.activity" :key="`${item.type}-${item.id}`">
            <span class="opportunity-card__dot" :class="`is-${item.type}`" />
            <small>{{ dateText(item.occurredAt) }}</small>
            <strong>{{ item.title }}</strong>
            <span>{{ item.summary }}</span>
          </div>
        </div>
        <div
          class="opportunity-card__next"
          :class="{ 'is-attention': !opportunity.currentAction && isOpen(opportunity) }"
        >
          <strong>{{ isOpen(opportunity) ? '下一步计划' : '结案结果' }}</strong>
          <span>{{ opportunity.currentAction?.content ?? terminalText(opportunity) }}</span>
          <small v-if="opportunity.currentAction">{{
            dateText(opportunity.currentAction.plannedAt)
          }}</small>
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
  opportunityAmountBasisLabel,
  opportunityStageLabel,
  opportunityStageTag,
} from '../opportunities/opportunity-presentation'

const props = defineProps<{ opportunities: CustomerOpportunitySummary[] }>()
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
.opportunity-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
}
.opportunity-progress__hint,
.opportunity-card__amount,
.opportunity-card__activity small,
.opportunity-card__next small {
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
.opportunity-card__activity {
  display: grid;
  gap: 0;
  margin-top: var(--crm-spacing-md);
}
.opportunity-card__activity > div {
  display: grid;
  grid-template-columns: 10px 74px 80px minmax(0, 1fr);
  gap: var(--crm-spacing-xs);
  align-items: baseline;
  padding: 6px 0;
  border-bottom: 1px dashed var(--crm-color-border);
}
.opportunity-card__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--crm-color-primary);
}
.opportunity-card__dot.is-won {
  background: var(--crm-color-success);
}
.opportunity-card__dot.is-lost,
.opportunity-card__dot.is-demand_disappeared {
  background: var(--crm-color-danger);
}
.opportunity-card__next {
  display: grid;
  grid-template-columns: 90px minmax(0, 1fr) auto;
  gap: var(--crm-spacing-xs);
  margin-top: var(--crm-spacing-sm);
  padding: var(--crm-spacing-sm);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-bg-page);
}
.opportunity-card__next.is-attention {
  background: #fff7e6;
}
.opportunity-card__attention {
  margin-top: var(--crm-spacing-sm);
  color: var(--el-color-warning-dark-2);
  font-size: var(--crm-font-size-xs);
}
</style>
