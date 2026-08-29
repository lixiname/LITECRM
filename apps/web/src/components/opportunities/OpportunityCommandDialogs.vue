<template>
  <el-dialog v-model="showProgress" title="记录商机推进并安排下一计划" width="520px">
    <el-alert
      v-if="sourcePlan"
      class="opportunity-dialog__plan"
      type="info"
      :closable="false"
      :title="`本次执行计划：${formatTime(sourcePlan.plannedAt)} · ${sourcePlan.content}`"
    />
    <el-form label-width="100px">
      <el-form-item label="跟进日期" required>
        <el-date-picker v-model="followForm.occurredAt" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="本次结论" required
        ><el-input v-model="followForm.conclusion"
      /></el-form-item>
      <el-form-item label="沟通方式">
        <el-select v-model="followForm.method" clearable placeholder="选择沟通方式">
          <el-option
            v-for="option in OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="本次有报价">
        <el-switch v-model="followForm.hasQuote" />
      </el-form-item>
      <template v-if="followForm.hasQuote">
        <el-alert
          v-if="currentQuote"
          class="opportunity-dialog__plan"
          type="warning"
          :closable="false"
          :title="`当前有效报价：${quoteKindLabel(currentQuote.kind)} · ${amountText(currentQuote.amount)} · ${formatTime(currentQuote.quotedAt)}；保存后将自动替代该版本。`"
        />
        <el-form-item label="报价类型" required>
          <el-radio-group v-model="quoteForm.kind">
            <el-radio value="oral">口头报价</el-radio>
            <el-radio value="formal">正式报价</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="报价金额" required>
          <el-input v-model.number="quoteForm.amount" type="number" />
        </el-form-item>
        <el-form-item v-if="quoteForm.kind === 'formal'" label="报价单号">
          <el-input v-model="quoteForm.quoteNo" />
        </el-form-item>
        <el-form-item v-if="quoteForm.kind === 'formal'" label="文件引用">
          <el-input v-model="quoteForm.documentRef" placeholder="可选链接或文件编号" />
        </el-form-item>
        <el-form-item label="报价说明">
          <el-input v-model="quoteForm.note" placeholder="如：调整配置后重新报价" />
        </el-form-item>
      </template>
      <el-form-item label="下一计划" required
        ><el-input v-model="followForm.nextActionContent"
      /></el-form-item>
      <el-form-item label="计划日期" required
        ><el-date-picker v-model="followForm.nextActionAt" type="date" value-format="YYYY-MM-DD"
      /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showProgress = false">取消</el-button>
      <el-button type="primary" :loading="acting" @click="handleProgress">保存推进</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="showWin" title="确认客户已下单" width="480px">
    <el-alert
      class="opportunity-dialog__plan"
      type="info"
      :closable="false"
      :title="
        currentQuote
          ? `成交将自动关联当前有效报价：${quoteKindLabel(currentQuote.kind)} · ${amountText(currentQuote.amount)}`
          : '当前没有有效报价，成交记录将不关联报价。'
      "
    />
    <el-form label-width="100px">
      <el-form-item label="下单日期" required
        ><el-date-picker v-model="winForm.occurredAt" type="date" value-format="YYYY-MM-DD"
      /></el-form-item>
      <el-form-item label="成交金额" required
        ><el-input v-model.number="winForm.amount" type="number"
      /></el-form-item>
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
  closeOpportunity,
  OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS,
  winOpportunity,
  type OpportunityDetail,
  type OpportunityQuote,
  type SalesPlan,
} from '@crm/domain'

const props = defineProps<{ opportunity: OpportunityDetail }>()
const emit = defineEmits<{ changed: [] }>()
const showProgress = ref(false)
const showWin = ref(false)
const showClose = ref(false)
const acting = ref(false)
const sourcePlan = ref<SalesPlan>()
const followForm = reactive({
  occurredAt: localDate(new Date()),
  conclusion: '',
  method: '',
  hasQuote: false,
  nextActionContent: '',
  nextActionAt: localDate(new Date()),
})
const quoteForm = reactive({
  kind: 'oral' as 'oral' | 'formal',
  amount: undefined as number | undefined,
  quoteNo: '',
  documentRef: '',
  note: '',
})
const winForm = reactive({
  occurredAt: localDate(new Date()),
  amount: undefined as number | undefined,
})
const closeForm = reactive({ result: 'lost' as 'lost' | 'demand_disappeared', reason: '' })
const activeQuotes = computed(() =>
  props.opportunity.quotes.filter((quote) => quote.status === 'active'),
)
const currentQuote = computed(() => activeQuotes.value[0])

function openProgress(plan?: SalesPlan, occurredDate?: string) {
  sourcePlan.value = plan
  followForm.conclusion = ''
  followForm.method = ''
  followForm.hasQuote = false
  followForm.occurredAt = occurredDate ?? localDate(new Date())
  quoteForm.kind = 'oral'
  quoteForm.amount = undefined
  quoteForm.quoteNo = ''
  quoteForm.documentRef = ''
  quoteForm.note = ''
  prefillNext(followForm, plan)
  showProgress.value = true
}
function openWin() {
  const quote = currentQuote.value
  winForm.amount = quote ? Number(quote.amount) : undefined
  showWin.value = true
}
function openClose() {
  showClose.value = true
}
defineExpose({ openProgress, openWin, openClose })

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

async function handleProgress() {
  if (
    !followForm.conclusion.trim() ||
    !followForm.nextActionContent.trim() ||
    !followForm.nextActionAt
  ) {
    return ElMessage.warning('请填写本次结论和下一计划')
  }
  if (followForm.hasQuote && quoteForm.amount == null) {
    return ElMessage.warning('请填写本次报价金额')
  }
  const succeeded = await runAction(
    () =>
      addOpportunityFollowUp(props.opportunity.id, {
        version: props.opportunity.version,
        conclusion: followForm.conclusion.trim(),
        occurredAt: followForm.occurredAt,
        method: followForm.method.trim() || undefined,
        quote: followForm.hasQuote
          ? {
              kind: quoteForm.kind,
              amount: quoteForm.amount!,
              quoteNo: quoteForm.quoteNo.trim() || undefined,
              documentRef:
                quoteForm.kind === 'formal' ? quoteForm.documentRef.trim() || undefined : undefined,
              note: quoteForm.note.trim() || undefined,
            }
          : undefined,
        sourcePlanId: sourcePlan.value?.id,
        nextActionContent: followForm.nextActionContent.trim(),
        nextActionAt: followForm.nextActionAt,
      }),
    followForm.hasQuote ? '推进与报价已记录' : '推进已记录',
  )
  if (succeeded) showProgress.value = false
}

async function handleWin() {
  if (winForm.amount == null || !winForm.occurredAt)
    return ElMessage.warning('请填写下单时间和成交金额')
  const succeeded = await runAction(
    () =>
      winOpportunity(props.opportunity.id, {
        version: props.opportunity.version,
        occurredAt: winForm.occurredAt,
        amount: winForm.amount!,
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
  return value
}
function localDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function prefillNext(
  target: { nextActionContent: string; nextActionAt: string },
  executingPlan?: SalesPlan,
) {
  const currentPlan = executingPlan ? undefined : props.opportunity.actions[0]
  target.nextActionContent = currentPlan?.content ?? ''
  target.nextActionAt = currentPlan ? currentPlan.plannedAt : localDate(tomorrow())
}

function tomorrow(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date
}
</script>

<style scoped>
.opportunity-dialog__plan {
  margin-bottom: var(--crm-spacing-md);
}
</style>
