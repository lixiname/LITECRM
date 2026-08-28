<template>
  <div class="opportunity-detail">
    <van-nav-bar :title="opportunity?.name ?? '商机详情'" left-arrow @click-left="router.back()" />

    <van-loading v-if="loading" class="opportunity-detail__loading" />
    <van-empty v-else-if="error" :description="error">
      <van-button size="small" type="primary" @click="reload">重新加载</van-button>
    </van-empty>

    <template v-else-if="opportunity">
      <van-notice-bar
        v-if="opportunity.riskFlags?.length"
        color="#9b6a00"
        background="#fff7e6"
        wrapable
        :scrollable="false"
        :text="`当前需关注：${opportunity.riskFlags.map((item) => OPPORTUNITY_RISK_LABELS[item]).join('、')}`"
      />

      <van-cell-group inset title="当前状态" class="opportunity-detail__section">
        <van-cell title="阶段">
          <template #value>
            <van-tag :type="stageTag(opportunity.stage)">{{
              stageLabel(opportunity.stage)
            }}</van-tag>
          </template>
        </van-cell>
        <van-cell
          title="所属客户"
          :value="opportunity.customerName ?? '-'"
          is-link
          @click="router.push(`/customers/${opportunity.customerId}`)"
        />
        <van-cell title="当前负责人" :value="opportunity.currentOwnerName ?? '-'" />
        <van-cell
          title="当前参考金额"
          :value="`${money(opportunity.referenceAmount)} · ${amountBasisLabel(opportunity.amountBasis)}`"
        />
        <van-cell title="下一计划" :value="opportunity.actions[0]?.content ?? '-'" />
        <van-cell title="计划时间" :value="dateTime(opportunity.actions[0]?.plannedAt)" />
        <van-cell title="需求发现日" :value="dateText(opportunity.discoveredDate)" />
        <van-cell title="预计成交日" :value="dateText(opportunity.expectedCloseDate)" />
        <van-cell title="金额说明" :value="opportunity.estimateNote || '-'" />
      </van-cell-group>

      <van-cell-group
        v-if="opportunity.deal"
        inset
        title="成交事实"
        class="opportunity-detail__section"
      >
        <van-cell title="成交金额" :value="money(opportunity.deal.amount)" />
        <van-cell title="客户下单时间" :value="dateTime(opportunity.deal.occurredAt)" />
      </van-cell-group>

      <van-cell-group inset title="报价记录" class="opportunity-detail__section">
        <van-cell
          v-for="quote in opportunity.quotes"
          :key="quote.id"
          :title="`${quote.kind === 'formal' ? '正式报价' : '口头报价'} · ${money(quote.amount)}`"
          :label="`${dateTime(quote.quotedAt)}${quote.note ? ` · ${quote.note}` : ''}`"
        >
          <template #value>
            <van-tag :type="quote.status === 'active' ? 'primary' : 'default'">
              {{ quote.status === 'active' ? '有效' : '已被替代' }}
            </van-tag>
          </template>
        </van-cell>
        <van-empty v-if="!opportunity.quotes.length" description="尚无报价" :image-size="54" />
      </van-cell-group>

      <van-cell-group inset title="跟进记录" class="opportunity-detail__section">
        <van-cell
          v-for="followUp in opportunity.followUps"
          :key="followUp.id"
          :title="followUp.conclusion"
          :label="`${dateTime(followUp.occurredAt)}${followUp.method ? ` · ${methodLabel(followUp.method)}` : ''}`"
        />
        <van-empty
          v-if="!opportunity.followUps.length"
          description="尚无跟进记录"
          :image-size="54"
        />
      </van-cell-group>

      <div v-if="canOperate" class="opportunity-detail__actions">
        <van-button plain type="primary" @click="openRecord('follow_up')">记跟进</van-button>
        <van-button plain type="primary" @click="openRecord('quote')">记报价</van-button>
        <van-button plain type="danger" @click="openClose">未成交结案</van-button>
        <van-button type="success" @click="openWin">确认成交</van-button>
      </div>
    </template>

    <van-popup v-model:show="winSheet.visible" position="bottom" round closeable>
      <van-form class="command-sheet" @submit="submitWin">
        <h3>确认客户已下单</h3>
        <van-notice-bar
          wrapable
          :scrollable="false"
          text="只有此确认动作才会生成成交记录；报价本身不代表成交。"
        />
        <van-cell
          title="关联报价"
          :label="
            currentQuote
              ? `自动关联当前有效报价：${currentQuote.kind === 'formal' ? '正式' : '口头'} · ${money(currentQuote.amount)}`
              : '当前没有有效报价，成交记录将不关联报价'
          "
        />
        <van-field v-model="winSheet.occurredAt" label="下单时间" type="datetime-local" required />
        <van-field v-model="winSheet.amount" label="成交金额" type="number" required />
        <van-field v-model="winSheet.note" label="备注" placeholder="可选" />
        <van-button block round type="success" native-type="submit" :loading="acting">
          确认成交
        </van-button>
      </van-form>
    </van-popup>

    <van-popup v-model:show="closeSheet.visible" position="bottom" round closeable>
      <van-form class="command-sheet" @submit="submitClose">
        <h3>未成交结案</h3>
        <van-notice-bar
          color="#9b2c2c"
          background="#fff1f0"
          wrapable
          :scrollable="false"
          text="结案后商机进入终态，剩余未完成计划将自动取消。"
        />
        <van-field label="结案结果" required>
          <template #input>
            <van-radio-group v-model="closeSheet.result" direction="horizontal">
              <van-radio name="lost">被友商抢走 / 丢失</van-radio>
              <van-radio name="demand_disappeared">需求消失</van-radio>
            </van-radio-group>
          </template>
        </van-field>
        <van-field v-model="closeSheet.reason" label="结案说明" type="textarea" rows="3" required />
        <van-button block round type="danger" native-type="submit" :loading="acting">
          确认结案
        </van-button>
      </van-form>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import {
  closeOpportunity,
  getOpportunity,
  OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS,
  OPPORTUNITY_INITIAL_AMOUNT_BASIS_OPTIONS,
  OPPORTUNITY_RISK_LABELS,
  OPPORTUNITY_STAGE_OPTIONS,
  useAuthStore,
  useQuery,
  winOpportunity,
  type OpportunityStage,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const opportunityId = String(route.params.id)
const {
  data: opportunity,
  loading,
  error,
  reload,
} = useQuery(`opportunity:detail:${opportunityId}`, () => getOpportunity(opportunityId))
const acting = ref(false)
const winSheet = reactive({
  visible: false,
  occurredAt: localInput(new Date()),
  amount: '',
  note: '',
})
const closeSheet = reactive({
  visible: false,
  result: 'lost' as 'lost' | 'demand_disappeared',
  reason: '',
})

const isOpen = computed(
  () => opportunity.value?.stage === 'intent' || opportunity.value?.stage === 'following',
)
const canOperate = computed(() => isOpen.value && auth.hasAbility('customer.write'))
const currentQuote = computed(() =>
  opportunity.value?.quotes.find((quote) => quote.status === 'active'),
)

function openRecord(mode: 'follow_up' | 'quote') {
  void router.push({
    path: `/opportunities/${opportunityId}/follow-up`,
    query: { mode },
  })
}

function openWin() {
  const quote = currentQuote.value
  winSheet.occurredAt = localInput(new Date())
  winSheet.amount = quote?.amount ?? opportunity.value?.referenceAmount ?? ''
  winSheet.note = ''
  winSheet.visible = true
}

function openClose() {
  closeSheet.result = 'lost'
  closeSheet.reason = ''
  closeSheet.visible = true
}

async function submitWin() {
  if (!opportunity.value || !winSheet.occurredAt || !winSheet.amount) {
    return showToast('请填写下单时间和成交金额')
  }
  try {
    await showConfirmDialog({
      title: '确认成交',
      message: `将记录成交金额 ${money(winSheet.amount)} 并结束当前商机，是否继续？`,
      confirmButtonText: '确认成交',
    })
  } catch {
    return
  }
  acting.value = true
  try {
    await winOpportunity(opportunityId, {
      version: opportunity.value.version,
      occurredAt: new Date(winSheet.occurredAt).toISOString(),
      amount: Number(winSheet.amount),
      note: winSheet.note.trim() || undefined,
    })
    showToast('成交已确认')
    winSheet.visible = false
    await reload()
  } catch (commandError) {
    showToast(commandError instanceof Error ? commandError.message : '确认成交失败')
  } finally {
    acting.value = false
  }
}

async function submitClose() {
  if (!opportunity.value || !closeSheet.reason.trim()) return showToast('请填写结案说明')
  try {
    await showConfirmDialog({
      title: '确认未成交结案',
      message:
        closeSheet.result === 'lost'
          ? '将商机标记为已丢失，并取消剩余计划。'
          : '将商机标记为需求消失，并取消剩余计划。',
      confirmButtonText: '确认结案',
      confirmButtonColor: '#ee0a24',
    })
  } catch {
    return
  }
  acting.value = true
  try {
    await closeOpportunity(opportunityId, {
      version: opportunity.value.version,
      result: closeSheet.result,
      reason: closeSheet.reason.trim(),
    })
    showToast('商机已结案')
    closeSheet.visible = false
    await reload()
  } catch (commandError) {
    showToast(commandError instanceof Error ? commandError.message : '结案失败')
  } finally {
    acting.value = false
  }
}

function stageLabel(stage: OpportunityStage): string {
  return OPPORTUNITY_STAGE_OPTIONS.find((item) => item.value === stage)?.label ?? stage
}
function stageTag(stage: OpportunityStage): 'primary' | 'warning' | 'success' | 'danger' {
  if (stage === 'won') return 'success'
  if (stage === 'lost' || stage === 'demand_disappeared') return 'danger'
  return stage === 'following' ? 'warning' : 'primary'
}
function amountBasisLabel(value: string): string {
  return (
    OPPORTUNITY_INITIAL_AMOUNT_BASIS_OPTIONS.find((item) => item.value === value)?.label ?? value
  )
}
function methodLabel(value: string): string {
  return OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS.find((item) => item.value === value)?.label ?? value
}
function money(value?: string | null): string {
  return value === undefined || value === null || value === ''
    ? '-'
    : `¥${Number(value).toLocaleString('zh-CN')}`
}
function dateTime(value?: string | null): string {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-'
}
function dateText(value?: string | null): string {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '-'
}
function localInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
</script>

<style scoped>
.opportunity-detail {
  min-height: 100vh;
  padding-bottom: 88px;
}
.opportunity-detail__loading {
  display: block;
  margin: var(--crm-spacing-xl) auto;
}
.opportunity-detail__section {
  margin-top: var(--crm-spacing-md);
}
.opportunity-detail__actions {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 4;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: var(--crm-spacing-sm);
  padding-bottom: max(var(--crm-spacing-sm), env(safe-area-inset-bottom));
  border-top: 1px solid var(--crm-color-border);
  background: var(--crm-color-bg-card);
}
.opportunity-detail__actions .van-button {
  min-width: 0;
  padding: 0 6px;
}
.command-sheet {
  display: grid;
  gap: var(--crm-spacing-md);
  max-height: 82vh;
  overflow-y: auto;
  padding: var(--crm-spacing-xl) var(--crm-spacing-md);
  padding-bottom: max(var(--crm-spacing-xl), env(safe-area-inset-bottom));
}
.command-sheet h3 {
  margin: 0;
  text-align: center;
}
</style>
