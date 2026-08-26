<template>
  <div class="detail">
    <van-nav-bar :title="detail?.name ?? '客户详情'" left-arrow @click-left="router.back()" />

    <van-cell-group
      v-if="auth.hasAbility('customer.write') && detail?.status === 'active'"
      inset
      title="快速登记"
    >
      <van-cell
        title="记一笔拜访"
        icon="guide-o"
        is-link
        @click="router.push(`/customers/${customerId}/visit/new`)"
      />
      <van-cell
        title="新建商机"
        icon="chart-trending-o"
        is-link
        @click="router.push(`/customers/${customerId}/opportunity/new`)"
      />
      <van-cell
        title="登记客诉"
        icon="warning-o"
        is-link
        @click="router.push(`/customers/${customerId}/complaint/new`)"
      />
    </van-cell-group>

    <van-cell-group v-if="detail" inset title="基本信息">
      <van-cell title="城市" :value="detail.city ?? '-'" />
      <van-cell title="产业" :value="detail.industry ?? '-'" />
      <van-cell title="等级" :value="detail.grade" />
      <van-cell title="状态" :value="statusLabel(detail.status)" />
      <van-cell title="负责人" :value="detail.ownerId === auth.user?.id ? '我' : '他人'" />
      <van-cell title="地址" :value="detail.address ?? '-'" />
    </van-cell-group>

    <van-cell-group v-if="detail" inset title="成交与商机">
      <van-cell title="历史成交次数" :value="detail.dealSummary?.count ?? 0" />
      <van-cell title="历史成交总额" :value="moneyText(detail.dealSummary?.totalAmount)" />
      <van-cell
        title="最近成交"
        :value="detail.latestDeals?.[0] ? moneyText(detail.latestDeals[0].amount) : '-'"
      />
    </van-cell-group>

    <van-cell-group v-if="detail?.opportunities?.length" inset title="相关商机（最近）">
      <van-cell
        v-for="opportunity in detail?.opportunities ?? []"
        :key="opportunity.id"
        :title="opportunity.name"
      >
        <template #label>
          <div class="customer-detail__line">
            <div class="customer-detail__meta">
              <van-tag :type="stageTag(opportunity.stage)">
                {{ stageLabel(opportunity.stage) }}
              </van-tag>
              <span>意向：{{ moneyText(opportunity.estimatedAmount) }}</span>
            </div>
            <span>最新报价：{{ moneyText(opportunity.latestQuote?.amount) }}</span>
            <span>下一步：{{ opportunity.currentAction?.content ?? '—' }}</span>
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group v-if="detail?.timeline?.length" inset title="活动时间线（最近）">
      <div class="timeline">
        <div
          v-for="item in detail?.timeline ?? []"
          :key="`${item.type}-${item.id}`"
          class="timeline__row"
        >
          <div class="timeline__time">{{ timeText(item.occurredAt) }}</div>
          <div class="timeline__line">
            <div class="timeline__dot" :class="`timeline__dot--${item.type}`" />
            <div class="timeline__bar" />
          </div>
          <div class="timeline__content">
            <div class="timeline__title">{{ item.title }}</div>
            <div class="timeline__summary">{{ item.summary }}</div>
          </div>
        </div>
      </div>
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import {
  useQuery,
  getCustomer,
  useAuthStore,
  CUSTOMER_STATUS_OPTIONS,
  OPPORTUNITY_STAGE_OPTIONS,
  type Opportunity,
  type CustomerStatus,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const customerId = route.params.id as string

const { data: detail } = useQuery(`customer:detail:${customerId}`, () => getCustomer(customerId))

function statusLabel(status: CustomerStatus): string {
  return CUSTOMER_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}

function stageTag(stage: Opportunity['stage']): 'primary' | 'warning' | 'success' | 'danger' {
  const map: Record<Opportunity['stage'], 'primary' | 'warning' | 'success' | 'danger'> = {
    won: 'success',
    lost: 'danger',
    demand_disappeared: 'danger',
    following: 'warning',
    intent: 'primary',
  }
  return map[stage]
}

function stageLabel(stage: Opportunity['stage']): string {
  return OPPORTUNITY_STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? stage
}

function moneyText(amount?: string | null): string {
  return amount ? `¥${Number(amount).toLocaleString()}` : '-'
}

function timeText(v: string): string {
  return new Date(v).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.customer-detail__line {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.customer-detail__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.timeline {
  display: flex;
  flex-direction: column;
  padding: var(--crm-spacing-sm) 0;
}

.timeline__row {
  display: grid;
  grid-template-columns: 82px 18px 1fr;
  gap: var(--crm-spacing-xs);
  align-items: flex-start;
  margin-bottom: var(--crm-spacing-sm);
}

.timeline__time {
  color: var(--crm-color-text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.timeline__line {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 44px;
}

.timeline__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--crm-color-primary);
}

.timeline__dot--visit,
.timeline__dot--opportunity_follow_up,
.timeline__dot--deal {
  background: #67c23a;
}

.timeline__dot--complaint {
  background: #e6a23c;
}

.timeline__bar {
  width: 1px;
  flex: 1;
  background: var(--crm-color-border);
  margin-top: 4px;
}

.timeline__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.timeline__title {
  font-size: 14px;
  font-weight: 600;
}

.timeline__summary {
  color: var(--crm-color-text-secondary);
  font-size: 13px;
}
</style>
