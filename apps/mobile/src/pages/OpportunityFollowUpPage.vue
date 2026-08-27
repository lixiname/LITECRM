<template>
  <div>
    <van-nav-bar title="执行商机计划" left-arrow @click-left="router.back()" />
    <van-notice-bar
      v-if="plan"
      wrapable
      :scrollable="false"
      :text="`原计划：${formatTime(plan.plannedAt)} · ${plan.content}`"
    />
    <van-tabs v-model:active="mode">
      <van-tab title="记录跟进" name="follow_up" />
      <van-tab title="记录报价" name="quote" />
    </van-tabs>
    <van-form @submit="submit">
      <van-cell-group inset>
        <template v-if="mode === 'follow_up'">
          <van-field v-model="conclusion" label="本次结论" type="textarea" rows="2" required />
          <van-field v-model="method" label="跟进方式" placeholder="电话、微信、现场拜访等" />
        </template>
        <template v-else>
          <van-field v-model="quoteKind" label="报价类型" placeholder="oral / formal" required />
          <van-field v-model="amount" label="报价金额" type="number" required />
          <van-field v-model="quoteNo" label="报价单号" placeholder="正式报价时选填" />
        </template>
        <van-field v-model="nextAt" label="下次时间" type="datetime-local" required />
        <van-field v-model="nextContent" label="下次内容" type="textarea" rows="2" required />
      </van-cell-group>
      <div class="submit">
        <van-button block round type="primary" native-type="submit" :loading="saving"
          >保存并安排下一次</van-button
        >
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  addOpportunityFollowUp,
  addOpportunityQuote,
  getOpportunity,
  getSalesPlan,
  type OpportunityDetail,
  type SalesPlan,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const opportunityId = String(route.params.id)
const planId = String(route.query.planId ?? '')
const opportunity = ref<OpportunityDetail>()
const plan = ref<SalesPlan>()
const mode = ref<'follow_up' | 'quote'>('follow_up')
const conclusion = ref('')
const method = ref('')
const quoteKind = ref<'oral' | 'formal'>('oral')
const amount = ref('')
const quoteNo = ref('')
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
  } catch (error) {
    showToast(error instanceof Error ? error.message : '加载失败')
  }
})

async function submit() {
  if (!opportunity.value || !nextAt.value || !nextContent.value.trim()) return
  saving.value = true
  try {
    if (mode.value === 'follow_up') {
      if (!conclusion.value.trim()) return showToast('请填写本次结论')
      await addOpportunityFollowUp(opportunityId, {
        version: opportunity.value.version,
        conclusion: conclusion.value.trim(),
        method: method.value.trim() || undefined,
        sourcePlanId: plan.value?.id,
        nextActionAt: new Date(nextAt.value).toISOString(),
        nextActionContent: nextContent.value.trim(),
      })
    } else {
      if (!amount.value) return showToast('请填写报价金额')
      await addOpportunityQuote(opportunityId, {
        version: opportunity.value.version,
        kind: quoteKind.value,
        quotedAt: new Date().toISOString(),
        amount: Number(amount.value),
        quoteNo: quoteNo.value.trim() || undefined,
        sourcePlanId: plan.value?.id,
        nextActionAt: new Date(nextAt.value).toISOString(),
        nextActionContent: nextContent.value.trim(),
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
function tomorrowAtNine() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function formatTime(value: string) {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
