<template>
  <div>
    <van-nav-bar
      :title="plan ? '执行商机计划' : '记录商机实际'"
      left-arrow
      @click-left="router.back()"
    />
    <van-notice-bar
      v-if="plan"
      wrapable
      :scrollable="false"
      :text="`原计划：${formatTime(plan.plannedAt)} · ${plan.content}`"
    />
    <van-notice-bar
      v-else-if="existingPlan"
      color="#9b6a00"
      background="#fff7e6"
      wrapable
      :scrollable="false"
      :text="`已有计划：${formatTime(existingPlan.plannedAt)} · ${existingPlan.content}`"
    />
    <van-tabs v-model:active="mode">
      <van-tab title="记录跟进" name="follow_up" />
      <van-tab title="记录报价" name="quote" />
    </van-tabs>
    <van-form @submit="submit">
      <van-cell-group inset>
        <van-radio-group
          v-if="!plan && existingPlan"
          v-model="planHandling"
          direction="horizontal"
          class="handling"
        >
          <van-radio name="execute">关联并完成原计划</van-radio>
          <van-radio name="keep">临时记录，保留原计划</van-radio>
        </van-radio-group>
        <template v-if="mode === 'follow_up'">
          <van-field v-model="occurredAt" label="跟进时间" type="datetime-local" required />
          <van-field v-model="conclusion" label="本次结论" type="textarea" rows="2" required />
          <van-field
            v-model="methodLabel"
            label="跟进方式"
            readonly
            is-link
            placeholder="选择沟通方式"
            @click="showMethod = true"
          />
        </template>
        <template v-else>
          <van-field
            v-model="quoteKindLabel"
            label="报价类型"
            readonly
            is-link
            required
            @click="showQuoteKind = true"
          />
          <van-field v-model="quotedAt" label="报价时间" type="datetime-local" required />
          <van-field v-model="amount" label="报价金额" type="number" required />
          <van-field
            v-if="quoteKind === 'formal'"
            v-model="quoteNo"
            label="报价单号"
            placeholder="选填"
          />
          <van-field
            v-model="supersedesLabel"
            label="改价自"
            readonly
            is-link
            placeholder="独立方案，不替代"
            @click="showSupersedes = true"
          />
          <van-field v-model="quoteNote" label="报价说明" placeholder="如：调整配置后重新报价" />
          <van-field
            v-if="quoteKind === 'formal'"
            v-model="documentRef"
            label="报价文件"
            placeholder="可选链接或文件编号"
          />
        </template>
        <van-field
          v-if="planHandling !== 'keep'"
          v-model="nextAt"
          label="下次时间"
          type="datetime-local"
          required
        />
        <van-field
          v-if="planHandling !== 'keep'"
          v-model="nextContent"
          label="下次内容"
          type="textarea"
          rows="2"
          required
        />
      </van-cell-group>
      <div class="submit">
        <van-button block round type="primary" native-type="submit" :loading="saving">
          {{ planHandling === 'keep' ? '保存本次记录' : '保存并安排下一次' }}
        </van-button>
      </div>
    </van-form>
    <van-popup v-model:show="showSupersedes" position="bottom" round>
      <van-picker
        :columns="supersedesColumns"
        @confirm="pickSupersedes"
        @cancel="showSupersedes = false"
      />
    </van-popup>
    <van-popup v-model:show="showMethod" position="bottom" round>
      <van-picker :columns="methodColumns" @confirm="pickMethod" @cancel="showMethod = false" />
    </van-popup>
    <van-popup v-model:show="showQuoteKind" position="bottom" round>
      <van-picker
        :columns="quoteKindColumns"
        @confirm="pickQuoteKind"
        @cancel="showQuoteKind = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  addOpportunityFollowUp,
  addOpportunityQuote,
  getOpportunity,
  getSalesPlan,
  OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS,
  OPPORTUNITY_QUOTE_KIND_OPTIONS,
  type OpportunityDetail,
  type SalesPlan,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const opportunityId = String(route.params.id)
const planId = String(route.query.planId ?? '')
const opportunity = ref<OpportunityDetail>()
const plan = ref<SalesPlan>()
const existingPlan = ref<SalesPlan>()
const planHandling = ref<'execute' | 'keep' | 'new'>('new')
const mode = ref<'follow_up' | 'quote'>('follow_up')
const occurredAt = ref(localInput(new Date()))
const conclusion = ref('')
const method = ref('')
const methodLabel = ref('')
const showMethod = ref(false)
const quoteKind = ref<'oral' | 'formal'>('oral')
const quoteKindLabel = ref('口头报价')
const showQuoteKind = ref(false)
const quotedAt = ref(localInput(new Date()))
const amount = ref('')
const quoteNo = ref('')
const quoteNote = ref('')
const documentRef = ref('')
const supersedesQuoteId = ref('')
const supersedesLabel = ref('')
const showSupersedes = ref(false)
const methodColumns = OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS.map((item) => ({
  text: item.label,
  value: item.value,
}))
const quoteKindColumns = OPPORTUNITY_QUOTE_KIND_OPTIONS.map((item) => ({
  text: item.label,
  value: item.value,
}))
const supersedesColumns = computed(() => [
  { text: '独立方案，不替代', value: '' },
  ...(opportunity.value?.quotes ?? [])
    .filter((quote) => quote.status === 'active')
    .map((quote) => ({
      text: `${quote.kind === 'formal' ? '正式' : '口头'} · ¥${Number(quote.amount).toLocaleString()}`,
      value: quote.id,
    })),
])
const nextAt = ref(tomorrowAtNine())
const nextContent = ref('')
const saving = ref(false)

onMounted(async () => {
  try {
    const [detail, sourcePlan] = await Promise.all([
      getOpportunity(opportunityId),
      planId ? getSalesPlan(planId) : Promise.resolve(undefined),
    ])
    opportunity.value = detail
    plan.value = sourcePlan
    existingPlan.value = detail.actions[0]
    planHandling.value = sourcePlan ? 'execute' : existingPlan.value ? 'execute' : 'new'
    mode.value = route.query.mode === 'quote' ? 'quote' : 'follow_up'
    const date = route.query.date as string | undefined
    if (date) {
      occurredAt.value = `${date}T09:00`
      quotedAt.value = `${date}T09:00`
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '加载失败')
  }
})

async function submit() {
  if (!opportunity.value) return
  if (planHandling.value !== 'keep' && (!nextAt.value || !nextContent.value.trim())) return
  saving.value = true
  try {
    const linkedPlan =
      plan.value ?? (planHandling.value === 'execute' ? existingPlan.value : undefined)
    if (mode.value === 'follow_up') {
      if (!conclusion.value.trim()) return showToast('请填写本次结论')
      await addOpportunityFollowUp(opportunityId, {
        version: opportunity.value.version,
        conclusion: conclusion.value.trim(),
        occurredAt: new Date(occurredAt.value).toISOString(),
        method: method.value.trim() || undefined,
        sourcePlanId: linkedPlan?.id,
        keepExistingPlan: planHandling.value === 'keep' || undefined,
        nextActionAt:
          planHandling.value === 'keep' ? undefined : new Date(nextAt.value).toISOString(),
        nextActionContent: planHandling.value === 'keep' ? undefined : nextContent.value.trim(),
      })
    } else {
      if (!amount.value) return showToast('请填写报价金额')
      await addOpportunityQuote(opportunityId, {
        version: opportunity.value.version,
        kind: quoteKind.value,
        quotedAt: new Date(quotedAt.value).toISOString(),
        amount: Number(amount.value),
        quoteNo: quoteNo.value.trim() || undefined,
        supersedesQuoteId: supersedesQuoteId.value || undefined,
        note: quoteNote.value.trim() || undefined,
        documentRef:
          quoteKind.value === 'formal' ? documentRef.value.trim() || undefined : undefined,
        sourcePlanId: linkedPlan?.id,
        keepExistingPlan: planHandling.value === 'keep' || undefined,
        nextActionAt:
          planHandling.value === 'keep' ? undefined : new Date(nextAt.value).toISOString(),
        nextActionContent: planHandling.value === 'keep' ? undefined : nextContent.value.trim(),
      })
    }
    showToast(mode.value === 'follow_up' ? '跟进已记录' : '报价已记录')
    router.back()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}
function pickSupersedes({
  selectedOptions,
}: {
  selectedOptions: { text: string; value: string }[]
}) {
  supersedesQuoteId.value = selectedOptions[0].value
  supersedesLabel.value = selectedOptions[0].value ? selectedOptions[0].text : ''
  showSupersedes.value = false
}
function pickMethod({ selectedOptions }: { selectedOptions: { text: string; value: string }[] }) {
  method.value = selectedOptions[0].value
  methodLabel.value = selectedOptions[0].text
  showMethod.value = false
}
function pickQuoteKind({
  selectedOptions,
}: {
  selectedOptions: { text: string; value: 'oral' | 'formal' }[]
}) {
  quoteKind.value = selectedOptions[0].value
  quoteKindLabel.value = selectedOptions[0].text
  showQuoteKind.value = false
}
function tomorrowAtNine() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
function localInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
</script>

<style scoped>
.submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
.handling {
  display: flex;
  gap: 10px;
  padding: var(--crm-spacing-md);
}
</style>
