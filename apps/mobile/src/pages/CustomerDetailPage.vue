<template>
  <div class="detail">
    <van-nav-bar :title="detail?.name ?? '客户详情'" left-arrow @click-left="router.back()" />

    <van-cell-group
      v-if="auth.hasAbility('customer.write') && detail?.status === 'active'"
      inset
      title="快速登记"
      class="detail__quick"
    >
      <van-cell title="记一笔拜访" icon="guide-o" is-link @click="openVisit" />
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

    <van-cell-group
      v-if="detail?.complaints?.length"
      inset
      title="客诉处理"
      class="detail__complaints"
    >
      <van-cell
        v-for="complaint in detail.complaints"
        :key="complaint.id"
        :title="complaint.description"
        :label="
          complaint.currentAction?.content ??
          (complaint.status === 'resolved'
            ? (complaint.resolution ?? '已解决')
            : '暂无下一处理行动')
        "
        is-link
        @click="router.push(`/complaints/${complaint.id}`)"
      >
        <template #value>
          <van-tag :type="complaint.status === 'resolved' ? 'success' : 'danger'">
            {{ complaint.status === 'resolved' ? '已解决' : '处理中' }}
          </van-tag>
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group
      v-if="detail?.opportunities?.length"
      inset
      title="商机进展"
      class="detail__opportunities"
    >
      <van-cell
        v-for="opportunity in detail?.opportunities ?? []"
        :key="opportunity.id"
        :title="opportunity.name"
        is-link
        @click="router.push(`/opportunities/${opportunity.id}`)"
      >
        <template #label>
          <div class="customer-detail__line">
            <div class="customer-detail__meta">
              <van-tag :type="stageTag(opportunity.stage)">
                {{ stageLabel(opportunity.stage) }}
              </van-tag>
              <span
                >参考金额：{{ moneyText(opportunity.referenceAmount) }} ·
                {{ amountBasisLabel(opportunity.amountBasis) }}</span
              >
            </div>
            <div class="customer-detail__activity">
              <div v-for="item in opportunity.activity" :key="`${item.type}-${item.id}`">
                <span class="customer-detail__dot" :class="`is-${item.type}`" />
                <small>{{ timeText(item.occurredAt) }}</small>
                <strong>{{ item.title }}</strong>
                <span>{{ item.summary }}</span>
              </div>
            </div>
            <div
              class="customer-detail__next"
              :class="{
                'is-alert':
                  !opportunity.currentAction &&
                  (opportunity.stage === 'intent' || opportunity.stage === 'following'),
              }"
            >
              <strong>下一步计划</strong>
              <span>{{ opportunity.currentAction?.content ?? terminalText(opportunity) }}</span>
              <small v-if="opportunity.currentAction">{{
                opportunity.currentAction.plannedAt
              }}</small>
            </div>
          </div>
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group
      v-if="detail?.timeline?.length"
      inset
      title="客户活动时间线"
      class="detail__timeline"
    >
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

    <van-cell-group v-if="detail" inset title="经营结果" class="detail__result">
      <van-cell title="CRM内成交次数" :value="detail.dealSummary?.count ?? 0" />
      <van-cell
        title="CRM前历史成交"
        :value="
          detail.dealSummary?.preCrmAmount == null
            ? detail.preCrmDealConfirmed
              ? '金额未知'
              : '不适用'
            : moneyText(detail.dealSummary.preCrmAmount)
        "
      />
      <van-cell title="CRM内成交" :value="moneyText(detail.dealSummary?.crmAmount)" />
      <van-cell title="累计参考成交" :value="moneyText(detail.dealSummary?.referenceTotalAmount)" />
      <van-cell
        title="最近成交"
        :value="detail.latestDeals?.[0] ? moneyText(detail.latestDeals[0].amount) : '-'"
      />
    </van-cell-group>

    <van-cell-group v-if="detail?.contacts.length" inset title="联系人" class="detail__contacts">
      <van-cell
        v-for="contact in detail.contacts"
        :key="contact.id"
        :title="contact.name || '未命名联系人'"
        :value="maskPhone(contact.phone)"
        :label="contactDescription(contact.title, contact.functionRole)"
      >
        <template #icon>
          <van-tag v-if="contact.isKeyContact" plain type="success" class="detail__contact-tag">
            首要
          </van-tag>
        </template>
      </van-cell>
    </van-cell-group>

    <van-cell-group v-if="detail" inset title="客户档案" class="detail__profile">
      <van-cell
        title="省 / 地级市"
        :value="[detail.province, detail.city].filter(Boolean).join(' / ') || '-'"
      />
      <van-cell title="销售大区" :value="detail.salesRegionName ?? '-'" />
      <van-cell title="客户行业" :value="dimensionLabel('industry', detail.industry)" />
      <van-cell title="具体领域" :value="dimensionLabel('sub_industry', detail.subIndustry)" />
      <van-cell title="等级" :value="detail.grade" />
      <van-cell title="经营阶段" :value="relationshipLabel(detail.relationshipStage)" />
      <van-cell title="状态" :value="statusLabel(detail.status)" />
      <van-cell title="负责人" :value="detail.ownerId === auth.user?.id ? '我' : '他人'" />
      <van-cell title="地址" :value="detail.address ?? '-'" />
    </van-cell-group>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import {
  useQuery,
  getCustomer,
  listDimensionOptions,
  useAuthStore,
  CUSTOMER_STATUS_OPTIONS,
  CUSTOMER_RELATIONSHIP_STAGE_OPTIONS,
  OPPORTUNITY_STAGE_OPTIONS,
  OPPORTUNITY_INITIAL_AMOUNT_BASIS_OPTIONS,
  type Opportunity,
  type CustomerStatus,
  type OpportunityInitialAmountBasis,
  type CustomerRelationshipStage,
  type Contact,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const customerId = route.params.id as string

const { data: detail } = useQuery(`customer:detail:${customerId}`, () => getCustomer(customerId))
const { data: dimensions } = useQuery('catalog:customer-profile', async () => [
  ...(await listDimensionOptions('industry')),
  ...(await listDimensionOptions('sub_industry')),
  ...(await listDimensionOptions('contact_function')),
])

function statusLabel(status: CustomerStatus): string {
  return CUSTOMER_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
}

function relationshipLabel(stage: CustomerRelationshipStage): string {
  return CUSTOMER_RELATIONSHIP_STAGE_OPTIONS.find((item) => item.value === stage)?.label ?? stage
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

function amountBasisLabel(basis: OpportunityInitialAmountBasis): string {
  return (
    OPPORTUNITY_INITIAL_AMOUNT_BASIS_OPTIONS.find((item) => item.value === basis)?.label ?? basis
  )
}

function terminalText(opportunity: Opportunity): string {
  if (opportunity.stage === 'won') return '已确认成交'
  if (opportunity.stage === 'lost') return '商机已丢失'
  if (opportunity.stage === 'demand_disappeared') return '需求已消失'
  return '尚未安排下一步'
}

function timeText(v: string): string {
  return v.length === 10 ? v : new Date(v).toLocaleString('zh-CN', { hour12: false })
}

function dimensionLabel(dimension: string, value?: string | null): string {
  if (!value) return '-'
  return (
    dimensions.value?.find((item) => item.dimension === dimension && item.name === value)?.label ??
    value
  )
}

function contactDescription(
  title: Contact['title'],
  functionRole: Contact['functionRole'],
): string {
  return (
    [title, dimensionLabel('contact_function', functionRole)]
      .filter((value) => value && value !== '-')
      .join(' · ') || '未填写职务和岗位类别'
  )
}

function maskPhone(phone?: string | null): string {
  if (!phone) return '-'
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 11) return `${digits.slice(0, 3)}****${digits.slice(-4)}`
  return phone
}

function openVisit() {
  router.push(`/customers/${customerId}/visit/new`)
}
</script>

<style scoped>
.detail {
  display: flex;
  flex-direction: column;
}
.detail__contact-tag {
  margin-right: var(--crm-spacing-xs);
}
.customer-detail__line {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.customer-detail__activity {
  display: grid;
  gap: 0;
  margin-top: 4px;
}
.customer-detail__activity > div {
  display: grid;
  grid-template-columns: 8px 66px 64px minmax(0, 1fr);
  gap: 4px;
  align-items: baseline;
  padding: 5px 0;
  border-bottom: 1px dashed var(--crm-color-border);
  font-size: 11px;
}
.customer-detail__activity small {
  color: var(--crm-color-text-secondary);
}
.customer-detail__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--crm-color-primary);
}
.customer-detail__dot.is-won {
  background: var(--crm-color-success);
}
.customer-detail__dot.is-lost,
.customer-detail__dot.is-demand_disappeared {
  background: var(--crm-color-danger);
}
.customer-detail__next {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  gap: 4px;
  margin-top: 6px;
  padding: 6px;
  border-radius: 4px;
  background: var(--crm-color-bg-page);
}
.customer-detail__next.is-alert {
  color: #d46b08;
  background: #fff7e6;
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
