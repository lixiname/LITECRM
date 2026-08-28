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
          <el-button type="primary" @click="businessDialogs?.openVisit()"> 记拜访 </el-button>
          <el-button @click="businessDialogs?.openOpportunity()">建商机</el-button>
          <el-button @click="businessDialogs?.openComplaint()">登客诉</el-button>
        </template>
        <el-button v-if="canClaim" type="success" @click="handleClaim">认领</el-button>
        <el-button v-if="canRestore" type="success" @click="showRestore = true">
          恢复客户
        </el-button>
        <template v-if="detail && detail.status === 'active'">
          <el-button v-if="auth.hasAbility('customer.transfer')" @click="showTransfer = true">
            移交
          </el-button>
          <el-tooltip
            v-if="canRelease && releaseBlocked"
            :content="releaseBlockReason"
            placement="bottom"
          >
            <span>
              <el-button type="danger" plain disabled>客户状态</el-button>
            </span>
          </el-tooltip>
          <el-button v-else-if="canRelease" type="danger" plain @click="showRelease = true">
            客户状态
          </el-button>
          <el-button
            v-if="auth.hasAbility('customer.transfer') && !isOwner"
            @click="showClaimReq = true"
          >
            申请接管
          </el-button>
        </template>
      </template>
    </AppPageHeader>

    <div v-if="detail" class="detail__workspace">
      <main class="detail__main">
        <CustomerOpportunityProgress :opportunities="detail.opportunities ?? []" />
        <CustomerActivityTimeline :items="detail.timeline ?? []" />
      </main>
      <aside class="detail__aside">
        <el-card class="detail__card">
          <template #header>经营概览</template>
          <div class="detail__metrics">
            <div>
              <strong>{{ detail.dealSummary?.count ?? 0 }}</strong
              ><span>历史成交</span>
            </div>
            <div>
              <strong>{{ moneyText(detail.dealSummary?.totalAmount) }}</strong
              ><span>成交总额</span>
            </div>
            <div>
              <strong>{{
                detail.opportunities?.filter(
                  (item) => item.stage === 'intent' || item.stage === 'following',
                ).length ?? 0
              }}</strong
              ><span>开放商机</span>
            </div>
          </div>
        </el-card>
        <CustomerContactsCard
          :customer-id="customerId"
          :contacts="detail.contacts"
          :editable="canEdit"
          @changed="reload"
        />
        <CustomerProfileCard
          :customer="detail"
          :owner-label="isOwner ? '我' : '他人'"
          :editable="canEdit"
          @edit="editDialog?.open()"
        />
      </aside>
    </div>

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
    <el-dialog v-model="showRelease" title="变更客户状态" width="440px">
      <el-alert
        class="detail__dialog-alert"
        type="warning"
        :closable="false"
        title="开放商机或未解决客诉会阻止变更；普通待拜访计划将自动取消并留痕。"
      />
      <el-form label-width="80px">
        <el-form-item label="去向" required>
          <el-radio-group v-model="releaseForm.target">
            <el-radio value="pool">公海（他人可认领）</el-radio>
            <el-radio v-if="canMarkInvalid" value="invalid">标记无效</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="原因" required>
          <el-input v-model="releaseForm.reason" placeholder="释放原因" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRelease = false">取消</el-button>
        <el-button type="danger" :loading="acting" @click="handleRelease">确认变更</el-button>
      </template>
    </el-dialog>

    <!-- 恢复无效档案 -->
    <el-dialog v-model="showRestore" title="恢复无效客户" width="440px">
      <el-alert
        class="detail__dialog-alert"
        type="info"
        :closable="false"
        title="恢复后客户重新进入在案状态；历史业务记录保持不变。"
      />
      <el-form label-width="90px">
        <el-form-item label="负责人" required>
          <el-select v-model="restoreForm.toOwnerId" filterable style="width: 100%">
            <el-option
              v-for="user in restoreAssignees"
              :key="user.id"
              :label="`${user.displayName}${user.region ? ` · ${user.region}` : ''}`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="恢复原因" required>
          <el-input v-model="restoreForm.reason" placeholder="说明为何重新纳入经营" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRestore = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="handleRestore">确认恢复</el-button>
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
      :current-visit-plan="detail.currentVisitPlan ?? undefined"
      @changed="handleBusinessChanged"
    />
    <CustomerEditDialog v-if="detail" ref="editDialog" :customer="detail" @saved="reload" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import CustomerBusinessDialogs from '../components/customers/CustomerBusinessDialogs.vue'
import CustomerProfileCard from '../components/customers/CustomerProfileCard.vue'
import CustomerContactsCard from '../components/customers/CustomerContactsCard.vue'
import CustomerActivityTimeline from '../components/customers/CustomerActivityTimeline.vue'
import CustomerOpportunityProgress from '../components/customers/CustomerOpportunityProgress.vue'
import CustomerEditDialog from '../components/customers/CustomerEditDialog.vue'
import {
  useAuthStore,
  useQuery,
  getCustomer,
  transferCustomer,
  releaseCustomer,
  claimCustomer,
  restoreCustomer,
  createClaim,
  listCustomerAssignees,
  getSalesPlan,
  type SalesPlan,
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
const showRestore = ref(false)
const acting = ref(false)
const businessDialogs = ref<InstanceType<typeof CustomerBusinessDialogs>>()
const editDialog = ref<InstanceType<typeof CustomerEditDialog>>()
const executionPlan = ref<SalesPlan>()
const executionOpened = ref(false)
const recordOpened = ref(false)

onMounted(async () => {
  const planId = route.query.executePlan as string | undefined
  if (!planId) return
  try {
    const plan = await getSalesPlan(planId)
    if (plan.planKind !== 'customer_visit' || plan.customerId !== customerId) return
    executionPlan.value = plan
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '计划加载失败')
  }
})

watch([detail, executionPlan], async ([customer, plan]) => {
  if (!customer || !plan || executionOpened.value) return
  await nextTick()
  if (!businessDialogs.value) return
  businessDialogs.value.openVisit(plan)
  executionOpened.value = true
})

watch(
  () => detail.value,
  async (customer) => {
    const record = route.query.record
    if (!customer || (record !== 'visit' && record !== 'complaint') || recordOpened.value) return
    await nextTick()
    const date = route.query.date as string | undefined
    if (record === 'visit') businessDialogs.value?.openVisit(undefined, date)
    else businessDialogs.value?.openComplaint(date)
    recordOpened.value = true
  },
  { immediate: true },
)

const transferForm = reactive({ toOwnerId: '', reason: '' })
const releaseForm = reactive({ target: 'pool' as 'pool' | 'invalid', reason: '' })
const restoreForm = reactive({ toOwnerId: '', reason: '' })
const claimReason = ref('')

const isOwner = computed(() => detail.value?.ownerId === auth.user?.id)
const isPublic = computed(() => detail.value?.status === 'public')
const isManager = computed(() => auth.user?.role === 'executive' || auth.user?.role === 'admin')
const canClaim = computed(
  () => isPublic.value && (auth.user?.role === 'sales' || auth.user?.role === 'executive'),
)
const canRelease = computed(
  () => detail.value?.status === 'active' && (isOwner.value || isManager.value),
)
const openOpportunityCount = computed(
  () =>
    detail.value?.opportunities?.filter(
      (item) => item.stage === 'intent' || item.stage === 'following',
    ).length ?? 0,
)
const unresolvedComplaintCount = computed(
  () => detail.value?.complaints?.filter((item) => item.status === 'registered').length ?? 0,
)
const releaseBlocked = computed(
  () => openOpportunityCount.value > 0 || unresolvedComplaintCount.value > 0,
)
const releaseBlockReason = computed(() => {
  const blockers: string[] = []
  if (openOpportunityCount.value > 0) blockers.push(`${openOpportunityCount.value} 个开放商机`)
  if (unresolvedComplaintCount.value > 0) {
    blockers.push(`${unresolvedComplaintCount.value} 个未解决客诉`)
  }
  return `暂不能变更客户状态：存在${blockers.join('、')}，请先处理或移交客户`
})
const canMarkInvalid = computed(() => isManager.value)
const canRestore = computed(() => detail.value?.status === 'invalid' && isManager.value)
const canEdit = computed(() =>
  Boolean(detail.value?.status === 'active' && auth.hasAbility('customer.write')),
)
const availableAssignees = computed(
  () => assignees.value?.filter((user) => user.id !== detail.value?.ownerId) ?? [],
)
const restoreAssignees = computed(() => {
  if (!detail.value?.salesRegionId) return assignees.value ?? []
  return (assignees.value ?? []).filter((user) => user.region === detail.value?.salesRegionName)
})

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

async function handleRestore() {
  if (!restoreForm.toOwnerId || !restoreForm.reason.trim()) {
    return ElMessage.warning('请选择负责人并填写恢复原因')
  }
  await runAction(
    () =>
      restoreCustomer(customerId, {
        toOwnerId: restoreForm.toOwnerId,
        reason: restoreForm.reason.trim(),
      }),
    '客户已恢复为在案',
  )
  showRestore.value = false
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
  if (kind === 'visit') void reload()
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
.detail__workspace {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(300px, 1fr);
  gap: var(--crm-spacing-lg);
  align-items: start;
}
.detail__main,
.detail__aside {
  display: grid;
  gap: var(--crm-spacing-lg);
}
.detail__metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--crm-spacing-sm);
}
.detail__metrics > div {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.detail__metrics span {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.detail__dialog-alert {
  margin-bottom: var(--crm-spacing-md);
}
</style>
