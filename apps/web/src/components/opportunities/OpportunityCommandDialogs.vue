<template>
  <el-dialog v-model="showFollow" title="记录跟进并安排下一计划" width="480px">
    <el-alert
      v-if="opportunity.actions[0]"
      class="opportunity-dialog__plan"
      type="info"
      :closable="false"
      :title="`原计划：${formatTime(opportunity.actions[0].plannedAt)} · ${opportunity.actions[0].content}`"
    />
    <el-form label-width="100px">
      <el-form-item label="本次结论" required
        ><el-input v-model="followForm.conclusion"
      /></el-form-item>
      <el-form-item label="沟通方式"><el-input v-model="followForm.method" /></el-form-item>
      <el-form-item label="下一计划" required
        ><el-input v-model="followForm.nextActionContent"
      /></el-form-item>
      <el-form-item label="计划时间" required
        ><el-input v-model="followForm.nextActionAt" type="datetime-local"
      /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showFollow = false">取消</el-button>
      <el-button type="primary" :loading="acting" @click="handleFollow">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showQuote" title="记录报价（不会自动成交）" width="480px">
    <el-form label-width="100px">
      <el-form-item label="报价类型" required>
        <el-radio-group v-model="quoteForm.kind">
          <el-radio value="oral">口头报价</el-radio>
          <el-radio value="formal">正式报价</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="报价时间" required
        ><el-input v-model="quoteForm.quotedAt" type="datetime-local"
      /></el-form-item>
      <el-form-item label="报价金额" required
        ><el-input v-model.number="quoteForm.amount" type="number"
      /></el-form-item>
      <el-form-item v-if="quoteForm.kind === 'formal'" label="报价单号"
        ><el-input v-model="quoteForm.quoteNo"
      /></el-form-item>
      <el-form-item label="替代报价">
        <el-select v-model="quoteForm.supersedesQuoteId" clearable placeholder="不替代">
          <el-option
            v-for="quote in activeQuotes"
            :key="quote.id"
            :label="`${quoteKindLabel(quote.kind)} · ${amountText(quote.amount)} · ${formatTime(quote.quotedAt)}`"
            :value="quote.id"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="下一计划" required>
        <el-input v-model="quoteForm.nextActionContent" placeholder="如：确认客户对报价的反馈" />
      </el-form-item>
      <el-form-item label="计划时间" required>
        <el-input v-model="quoteForm.nextActionAt" type="datetime-local" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showQuote = false">取消</el-button>
      <el-button type="primary" :loading="acting" @click="handleQuote">保存报价</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showWin" title="确认客户已下单" width="480px">
    <el-form label-width="100px">
      <el-form-item label="下单时间" required
        ><el-input v-model="winForm.occurredAt" type="datetime-local"
      /></el-form-item>
      <el-form-item label="成交金额" required
        ><el-input v-model.number="winForm.amount" type="number"
      /></el-form-item>
      <el-form-item label="接受报价">
        <el-select v-model="winForm.acceptedQuoteId" clearable placeholder="未关联报价">
          <el-option
            v-for="quote in activeQuotes"
            :key="quote.id"
            :label="`${quoteKindLabel(quote.kind)} · ${amountText(quote.amount)}`"
            :value="quote.id"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <el-alert
      type="info"
      :closable="false"
      title="只有此确认动作才会生成成交记录；报价本身不会成交。"
    />
    <template #footer>
      <el-button @click="showWin = false">取消</el-button>
      <el-button type="success" :loading="acting" @click="handleWin">确认成交</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showClose" title="未成交结案" width="440px">
    <el-alert type="warning" :closable="false" title="结案后商机进入终态，剩余未完成计划将取消。" />
    <el-form label-width="90px">
      <el-form-item label="结果" required>
        <el-radio-group v-model="closeForm.result">
          <el-radio value="lost">丢失</el-radio>
          <el-radio value="demand_disappeared">需求消失</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="说明" required><el-input v-model="closeForm.reason" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showClose = false">取消</el-button>
      <el-button type="danger" :loading="acting" @click="handleClose">确认结案</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  addOpportunityFollowUp,
  addOpportunityQuote,
  closeOpportunity,
  winOpportunity,
  type OpportunityDetail,
  type OpportunityQuote,
} from '@crm/domain'

const props = defineProps<{ opportunity: OpportunityDetail }>()
const emit = defineEmits<{ changed: [] }>()
const showFollow = ref(false)
const showQuote = ref(false)
const showWin = ref(false)
const showClose = ref(false)
const acting = ref(false)
const followForm = reactive({
  conclusion: '',
  method: '',
  nextActionContent: '',
  nextActionAt: localInput(new Date()),
})
const quoteForm = reactive({
  kind: 'oral' as 'oral' | 'formal',
  quotedAt: localInput(new Date()),
  amount: undefined as number | undefined,
  quoteNo: '',
  supersedesQuoteId: '',
  nextActionContent: '确认客户对报价的反馈',
  nextActionAt: localInput(new Date()),
})
const winForm = reactive({
  occurredAt: localInput(new Date()),
  amount: undefined as number | undefined,
  acceptedQuoteId: '',
})
const closeForm = reactive({ result: 'lost' as 'lost' | 'demand_disappeared', reason: '' })
const activeQuotes = computed(() =>
  props.opportunity.quotes.filter((quote) => quote.status === 'active'),
)

function openFollow() {
  showFollow.value = true
}
function openQuote() {
  showQuote.value = true
}
function openWin() {
  const quote = activeQuotes.value[0]
  winForm.acceptedQuoteId = quote?.id ?? ''
  winForm.amount = quote ? Number(quote.amount) : undefined
  showWin.value = true
}
function openClose() {
  showClose.value = true
}
defineExpose({ openFollow, openQuote, openWin, openClose })

async function runAction(action: () => Promise<unknown>, message: string): Promise<boolean> {
  acting.value = true
  try {
    await action()
    ElMessage.success(message)
    emit('changed')
    return true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
    return false
  } finally {
    acting.value = false
  }
}

async function handleFollow() {
  if (
    !followForm.conclusion.trim() ||
    !followForm.nextActionContent.trim() ||
    !followForm.nextActionAt
  ) {
    return ElMessage.warning('请填写本次结论和下一计划')
  }
  const succeeded = await runAction(
    () =>
      addOpportunityFollowUp(props.opportunity.id, {
        version: props.opportunity.version,
        conclusion: followForm.conclusion.trim(),
        method: followForm.method.trim() || undefined,
        sourcePlanId: props.opportunity.actions[0]?.id,
        nextActionContent: followForm.nextActionContent.trim(),
        nextActionAt: new Date(followForm.nextActionAt).toISOString(),
      }),
    '跟进已记录',
  )
  if (succeeded) showFollow.value = false
}

async function handleQuote() {
  if (
    quoteForm.amount == null ||
    !quoteForm.quotedAt ||
    !quoteForm.nextActionContent.trim() ||
    !quoteForm.nextActionAt
  )
    return ElMessage.warning('请填写报价和报价后的下一计划')
  const succeeded = await runAction(
    () =>
      addOpportunityQuote(props.opportunity.id, {
        version: props.opportunity.version,
        kind: quoteForm.kind,
        quotedAt: new Date(quoteForm.quotedAt).toISOString(),
        amount: quoteForm.amount!,
        quoteNo: quoteForm.quoteNo.trim() || undefined,
        supersedesQuoteId: quoteForm.supersedesQuoteId || undefined,
        sourcePlanId: props.opportunity.actions[0]?.id,
        nextActionContent: quoteForm.nextActionContent.trim(),
        nextActionAt: new Date(quoteForm.nextActionAt).toISOString(),
      }),
    '报价已记录',
  )
  if (succeeded) showQuote.value = false
}

async function handleWin() {
  if (winForm.amount == null || !winForm.occurredAt)
    return ElMessage.warning('请填写下单时间和成交金额')
  const succeeded = await runAction(
    () =>
      winOpportunity(props.opportunity.id, {
        version: props.opportunity.version,
        occurredAt: new Date(winForm.occurredAt).toISOString(),
        amount: winForm.amount!,
        acceptedQuoteId: winForm.acceptedQuoteId || undefined,
      }),
    '成交已确认',
  )
  if (succeeded) showWin.value = false
}

async function handleClose() {
  if (!closeForm.reason.trim()) return ElMessage.warning('请填写结案说明')
  const succeeded = await runAction(
    () =>
      closeOpportunity(props.opportunity.id, {
        version: props.opportunity.version,
        result: closeForm.result,
        reason: closeForm.reason.trim(),
      }),
    '商机已结案',
  )
  if (succeeded) showClose.value = false
}

function quoteKindLabel(kind: OpportunityQuote['kind']): string {
  return kind === 'formal' ? '正式报价' : '口头报价'
}
function amountText(amount: string): string {
  return `¥${Number(amount).toLocaleString()}`
}
function formatTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
function localInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
</script>

<style scoped>
.opportunity-dialog__plan {
  margin-bottom: var(--crm-spacing-md);
}
</style>
