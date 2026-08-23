<template>
  <div v-loading="loading" class="opp-detail">
    <header class="opp-detail__header">
      <h1 class="opp-detail__title">{{ opp?.name ?? '商机详情' }}</h1>
      <div class="opp-detail__actions">
        <el-button @click="router.push('/opportunities')">返回列表</el-button>
        <template v-if="opp && (opp.stage === 'intent' || opp.stage === 'following')">
          <el-button @click="showAdvance = true">推进</el-button>
          <el-button type="success" @click="showOrder = true">转成交</el-button>
          <el-button type="danger" plain @click="showClose = true">结案</el-button>
        </template>
      </div>
    </header>

    <el-card v-if="opp" class="opp-detail__card">
      <template #header>商机信息（意向金额）</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">{{ opp.name }}</el-descriptions-item>
        <el-descriptions-item label="阶段">
          <el-tag :type="stageTag(opp.stage)">{{ stageLabel(opp.stage) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="意向金额">{{ amountText(opp.amount) }}</el-descriptions-item>
        <el-descriptions-item label="来源">{{ sourceLabel(opp.source) }}</el-descriptions-item>
        <el-descriptions-item label="下一步">{{ opp.nextAction ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="下次跟进">{{
          opp.nextFollowUpDate ?? '-'
        }}</el-descriptions-item>
      </el-descriptions>

      <el-descriptions
        v-if="opp.deal"
        class="opp-detail__deal"
        :column="2"
        border
        title="成交记录（最终金额）"
      >
        <el-descriptions-item label="成交金额">{{
          amountText(opp.deal.amount)
        }}</el-descriptions-item>
        <el-descriptions-item label="成交时间">{{
          formatTime(opp.deal.occurredAt)
        }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="opp" class="opp-detail__card">
      <template #header>事件流</template>
      <el-timeline>
        <el-timeline-item v-for="e in opp.events" :key="e.id" :timestamp="formatTime(e.occurredAt)">
          {{ eventText(e) }}
        </el-timeline-item>
      </el-timeline>
    </el-card>

    <!-- 推进 -->
    <el-dialog v-model="showAdvance" title="推进商机" width="420px">
      <el-form label-width="90px">
        <el-form-item label="结论"><el-input v-model="advanceForm.conclusion" /></el-form-item>
        <el-form-item label="下一步"><el-input v-model="advanceForm.nextAction" /></el-form-item>
        <el-form-item label="下次跟进"
          ><el-input v-model="advanceForm.nextFollowUpDate" placeholder="YYYY-MM-DD"
        /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdvance = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="handleAdvance">确认</el-button>
      </template>
    </el-dialog>

    <!-- 转成交 -->
    <el-dialog v-model="showOrder" title="转成交（生成 Deal）" width="420px">
      <el-form label-width="90px">
        <el-form-item label="报价金额" required>
          <el-input v-model.number="orderForm.quoteAmount" placeholder="最终成交金额（元）" />
        </el-form-item>
        <el-alert
          type="info"
          :closable="false"
          title="成交金额与意向金额独立记录（§8.5 金额分层）"
        />
      </el-form>
      <template #footer>
        <el-button @click="showOrder = false">取消</el-button>
        <el-button type="success" :loading="acting" @click="handleOrder">确认成交</el-button>
      </template>
    </el-dialog>

    <!-- 结案 -->
    <el-dialog v-model="showClose" title="结案" width="420px">
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
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  useQuery,
  getOpportunity,
  advanceOpportunity,
  closeOpportunity,
  OPPORTUNITY_STAGE_OPTIONS,
  OPPORTUNITY_SOURCE_OPTIONS,
  type OpportunityStage,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const oppId = route.params.id as string

const {
  data: opp,
  loading,
  reload,
} = useQuery(`opportunity:detail:${oppId}`, () => getOpportunity(oppId))

const showAdvance = ref(false)
const showOrder = ref(false)
const showClose = ref(false)
const acting = ref(false)
const advanceForm = reactive({ conclusion: '', nextAction: '', nextFollowUpDate: '' })
const orderForm = reactive({ quoteAmount: undefined as number | undefined })
const closeForm = reactive({ result: 'lost' as 'lost' | 'demand_disappeared', reason: '' })

function stageTag(stage: OpportunityStage): 'success' | 'warning' | 'info' | 'danger' {
  return stage === 'ordered'
    ? 'success'
    : stage === 'lost' || stage === 'demand_disappeared'
      ? 'danger'
      : stage === 'following'
        ? 'warning'
        : 'info'
}
function stageLabel(stage: OpportunityStage): string {
  return OPPORTUNITY_STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? stage
}
function sourceLabel(source: string): string {
  return OPPORTUNITY_SOURCE_OPTIONS.find((s) => s.value === source)?.label ?? source
}
function amountText(amount: string | null): string {
  return amount ? `¥${Number(amount).toLocaleString()}` : '-'
}
function formatTime(v: string): string {
  return v ? new Date(v).toLocaleString('zh-CN', { hour12: false }) : '-'
}
function eventText(e: { type: string; payload: unknown }): string {
  const p = (e.payload ?? {}) as {
    from?: string
    to?: string
    name?: string
    amount?: number
    reason?: string
  }
  if (e.type === 'created') return `创建商机（${p.name ?? ''}，意向 ¥${p.amount ?? '-'}）`
  if (e.type === 'stage_changed')
    return `阶段：${p.from ?? '-'} → ${p.to ?? '-'}${p.reason ? `（${p.reason}）` : ''}`
  return e.type
}

async function runAction(fn: () => Promise<unknown>, msg: string) {
  acting.value = true
  try {
    await fn()
    ElMessage.success(msg)
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    acting.value = false
  }
}

function handleAdvance() {
  void runAction(
    () =>
      advanceOpportunity(oppId, {
        conclusion: advanceForm.conclusion || undefined,
        nextAction: advanceForm.nextAction || undefined,
        nextFollowUpDate: advanceForm.nextFollowUpDate || undefined,
      }),
    '已推进',
  )
  showAdvance.value = false
}
function handleOrder() {
  if (orderForm.quoteAmount == null) return ElMessage.warning('请填写报价金额')
  void runAction(
    () => advanceOpportunity(oppId, { quoteAmount: orderForm.quoteAmount }),
    '已转成交',
  )
  showOrder.value = false
}
function handleClose() {
  if (!closeForm.reason) return ElMessage.warning('请填写结案说明')
  void runAction(
    () => closeOpportunity(oppId, { result: closeForm.result, reason: closeForm.reason }),
    '已结案',
  )
  showClose.value = false
}
</script>

<style scoped>
.opp-detail {
  padding: var(--crm-spacing-xl);
}
.opp-detail__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-lg);
}
.opp-detail__title {
  margin: 0;
  color: var(--crm-color-text-primary);
}
.opp-detail__actions {
  display: flex;
  gap: var(--crm-spacing-sm);
}
.opp-detail__card {
  max-width: 860px;
  margin-bottom: var(--crm-spacing-lg);
}
.opp-detail__deal {
  margin-top: var(--crm-spacing-md);
}
</style>
