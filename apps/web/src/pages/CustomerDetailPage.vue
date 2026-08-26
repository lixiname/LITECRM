<template>
  <div v-loading="loading" class="detail">
    <AppPageHeader
      :title="detail?.name ?? '客户详情'"
      description="客户资料、联系人、业务进展和归属状态"
      back-to="/customers"
      back-label="客户列表"
    >
      <template #actions>
        <template v-if="detail && detail.status === 'active' && auth.hasAbility('customer.write')">
          <el-button type="primary" @click="businessDialogs?.openVisit()">记拜访</el-button>
          <el-button @click="businessDialogs?.openOpportunity()">建商机</el-button>
          <el-button @click="businessDialogs?.openComplaint()">登客诉</el-button>
        </template>
        <el-button v-if="isPublic" type="success" @click="handleClaim">认领</el-button>
        <template v-if="detail && detail.status === 'active'">
          <el-button v-if="auth.hasAbility('customer.transfer')" @click="showTransfer = true">
            移交
          </el-button>
          <el-button v-if="isOwner" type="danger" plain @click="showRelease = true">释放</el-button>
          <el-button
            v-if="auth.hasAbility('customer.transfer') && !isOwner"
            @click="showClaimReq = true"
          >
            申请接管
          </el-button>
        </template>
      </template>
    </AppPageHeader>

    <CustomerProfileCard
      v-if="detail"
      :customer="detail"
      :owner-label="isOwner ? '我' : '他人'"
      :editable="canEdit"
      @edit="editDialog?.open()"
    />

    <CustomerContactsCard
      v-if="detail"
      :customer-id="customerId"
      :contacts="detail.contacts"
      :editable="canEdit"
      @changed="reload"
    />

    <el-card v-if="detail" class="detail__card">
      <template #header>成交与商机</template>
      <el-descriptions :column="3" border>
        <el-descriptions-item label="历史成交次数">{{
          detail.dealSummary?.count ?? 0
        }}</el-descriptions-item>
        <el-descriptions-item label="历史成交总额">{{
          moneyText(detail.dealSummary?.totalAmount)
        }}</el-descriptions-item>
        <el-descriptions-item label="最近成交">
          {{ detail.latestDeals?.[0] ? `¥${detail.latestDeals[0].amount}` : '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="detail" class="detail__card">
      <template #header>相关商机</template>
      <el-table :data="detail.opportunities ?? []" border>
        <el-table-column prop="name" label="商机" min-width="140" />
        <el-table-column label="阶段" width="90">
          <template #default="{ row }">
            <el-tag :type="stageTag((row as Opportunity).stage)">
              {{ stageLabel((row as Opportunity).stage) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="意向规模" width="110">
          <template #default="{ row }">{{
            amountText((row as Opportunity).estimatedAmount)
          }}</template>
        </el-table-column>
        <el-table-column label="下一行动" min-width="180">
          <template #default="{ row }">{{
            (row as Opportunity).currentAction?.content ?? '-'
          }}</template>
        </el-table-column>
        <el-table-column label="最新报价" width="130">
          <template #default="{ row }">{{
            amountText((row as Opportunity).latestQuote?.amount)
          }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <CustomerActivityTimeline v-if="detail" :items="detail.timeline ?? []" />

    <!-- 移交 -->
    <el-dialog v-model="showTransfer" title="移交客户" width="420px">
      <el-form label-width="80px">
        <el-form-item label="新负责人" required>
          <el-select
            v-model="transferForm.toOwnerId"
            filterable
            placeholder="按姓名或区域选择"
            style="width: 100%"
          >
            <el-option
              v-for="user in availableAssignees"
              :key="user.id"
              :label="`${user.displayName}${user.region ? ` · ${user.region}` : ''}`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="原因" required>
          <el-input v-model="transferForm.reason" placeholder="移交原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTransfer = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="handleTransfer">确认移交</el-button>
      </template>
    </el-dialog>

    <!-- 释放 -->
    <el-dialog v-model="showRelease" title="释放客户" width="420px">
      <el-alert
        class="detail__dialog-alert"
        type="warning"
        :closable="false"
        title="释放后未完成行动会被取消；存在未解决客诉时系统将阻止释放。"
      />
      <el-form label-width="80px">
        <el-form-item label="去向" required>
          <el-radio-group v-model="releaseForm.target">
            <el-radio value="pool">公海（他人可认领）</el-radio>
            <el-radio value="invalid">无效</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="原因" required>
          <el-input v-model="releaseForm.reason" placeholder="释放原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRelease = false">取消</el-button>
        <el-button type="danger" :loading="acting" @click="handleRelease">确认释放</el-button>
      </template>
    </el-dialog>

    <!-- 接管申请 -->
    <el-dialog v-model="showClaimReq" title="申请接管" width="420px">
      <el-form label-width="80px">
        <el-form-item label="理由" required>
          <el-input v-model="claimReason" placeholder="接管理由" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showClaimReq = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="handleClaimReq">提交申请</el-button>
      </template>
    </el-dialog>

    <CustomerBusinessDialogs
      v-if="detail"
      ref="businessDialogs"
      :customer-id="customerId"
      :customer-name="detail.name"
      @changed="handleBusinessChanged"
    />
    <CustomerEditDialog v-if="detail" ref="editDialog" :customer="detail" @saved="reload" />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import CustomerBusinessDialogs from '../components/customers/CustomerBusinessDialogs.vue'
import CustomerProfileCard from '../components/customers/CustomerProfileCard.vue'
import CustomerContactsCard from '../components/customers/CustomerContactsCard.vue'
import CustomerActivityTimeline from '../components/customers/CustomerActivityTimeline.vue'
import CustomerEditDialog from '../components/customers/CustomerEditDialog.vue'
import {
  useAuthStore,
  useQuery,
  getCustomer,
  transferCustomer,
  releaseCustomer,
  claimCustomer,
  createClaim,
  listCustomerAssignees,
  OPPORTUNITY_STAGE_OPTIONS,
  type Opportunity,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const customerId = route.params.id as string

const {
  data: detail,
  loading,
  reload,
} = useQuery(`customer:detail:${customerId}`, () => getCustomer(customerId))
const { data: assignees } = useQuery('customers:assignees', () =>
  auth.hasAbility('customer.transfer') ? listCustomerAssignees() : Promise.resolve([]),
)

const showTransfer = ref(false)
const showRelease = ref(false)
const showClaimReq = ref(false)
const acting = ref(false)
const businessDialogs = ref<InstanceType<typeof CustomerBusinessDialogs>>()
const editDialog = ref<InstanceType<typeof CustomerEditDialog>>()

const transferForm = reactive({ toOwnerId: '', reason: '' })
const releaseForm = reactive({ target: 'pool' as 'pool' | 'invalid', reason: '' })
const claimReason = ref('')

const isOwner = computed(() => detail.value?.ownerId === auth.user?.id)
const isPublic = computed(() => detail.value?.status === 'public')
const canEdit = computed(() =>
  Boolean(detail.value?.status === 'active' && auth.hasAbility('customer.write')),
)
const availableAssignees = computed(
  () => assignees.value?.filter((user) => user.id !== detail.value?.ownerId) ?? [],
)

function stageTag(stage: Opportunity['stage']): 'success' | 'warning' | 'info' | 'danger' {
  const stageMap: Record<Opportunity['stage'], 'success' | 'warning' | 'info' | 'danger'> = {
    won: 'success',
    lost: 'danger',
    demand_disappeared: 'danger',
    following: 'warning',
    intent: 'info',
  }
  return stageMap[stage]
}
function stageLabel(stage: Opportunity['stage']): string {
  return OPPORTUNITY_STAGE_OPTIONS.find((s) => s.value === stage)?.label ?? stage
}
function amountText(amount?: string | null): string {
  return amount ? `¥${Number(amount).toLocaleString()}` : '-'
}
function moneyText(amount?: string): string {
  return amount ? `¥${Number(amount).toLocaleString()}` : '-'
}

async function runAction(fn: () => Promise<unknown>, successMsg: string) {
  acting.value = true
  try {
    await fn()
    ElMessage.success(successMsg)
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    acting.value = false
  }
}

async function handleTransfer() {
  if (!transferForm.toOwnerId || !transferForm.reason) return ElMessage.warning('请填写完整')
  await runAction(
    () =>
      transferCustomer(customerId, {
        toOwnerId: transferForm.toOwnerId,
        reason: transferForm.reason,
      }),
    '移交成功',
  )
  showTransfer.value = false
}

async function handleRelease() {
  if (!releaseForm.reason) return ElMessage.warning('请填写释放原因')
  await runAction(
    () => releaseCustomer(customerId, { target: releaseForm.target, reason: releaseForm.reason }),
    '已释放',
  )
  showRelease.value = false
}

async function handleClaim() {
  await runAction(() => claimCustomer(customerId), '认领成功')
}

async function handleClaimReq() {
  if (!claimReason.value.trim()) return ElMessage.warning('请填写接管理由')
  await runAction(() => createClaim(customerId, claimReason.value.trim()), '接管申请已提交')
  showClaimReq.value = false
}

function handleBusinessChanged(kind: 'visit' | 'opportunity' | 'complaint', recordId: string) {
  if (kind === 'opportunity') void router.push(`/opportunities/${recordId}`)
  if (kind === 'complaint') void router.push(`/complaints/${recordId}`)
}
</script>

<style scoped>
.detail {
  padding: var(--crm-spacing-xl);
}
.detail__card {
  margin-bottom: var(--crm-spacing-lg);
}
.detail__dialog-alert {
  margin-bottom: var(--crm-spacing-md);
}
</style>
