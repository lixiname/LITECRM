<template>
  <div v-loading="loading" class="detail">
    <AppPageHeader
      :title="detail?.name ?? '客户详情'"
      description="客户资料、联系人和归属状态"
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

    <el-card v-if="detail" class="detail__card">
      <template #header>基本信息</template>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">{{ detail.name }}</el-descriptions-item>
        <el-descriptions-item label="城市">{{ detail.city ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="产业">{{ detail.industry ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="等级">{{ detail.grade }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="detail.status === 'active' ? 'success' : 'warning'">
            {{ statusLabel(detail.status) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="负责人">{{ isOwner ? '我' : '他人' }}</el-descriptions-item>
        <el-descriptions-item label="地址" :span="2">{{
          detail.address ?? '-'
        }}</el-descriptions-item>
        <el-descriptions-item label="备注" :span="2">{{
          detail.notes ?? '-'
        }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card v-if="detail" class="detail__card">
      <template #header>
        <div class="detail__contacts-header">
          <span>联系人</span>
          <el-button
            v-if="auth.hasAbility('customer.write') && detail.status === 'active'"
            size="small"
            @click="showAddContact = true"
          >
            + 添加
          </el-button>
        </div>
      </template>
      <el-table :data="detail.contacts" border>
        <el-table-column prop="name" label="姓名" min-width="100" />
        <el-table-column prop="title" label="职位" min-width="100" />
        <el-table-column prop="phone" label="电话" min-width="130" />
        <el-table-column label="首要" width="70">
          <template #default="{ row }">
            <el-tag v-if="row.isKeyContact" size="small" type="success">首要</el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

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

    <!-- 添加联系人 -->
    <el-dialog v-model="showAddContact" title="添加联系人" width="420px">
      <el-form label-width="70px">
        <el-form-item label="姓名"><el-input v-model="contactForm.name" /></el-form-item>
        <el-form-item label="职位"><el-input v-model="contactForm.title" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="contactForm.phone" /></el-form-item>
        <el-form-item label="首要">
          <el-switch v-model="contactForm.isKeyContact" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddContact = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="handleAddContact">确认</el-button>
      </template>
    </el-dialog>

    <CustomerBusinessDialogs
      v-if="detail"
      ref="businessDialogs"
      :customer-id="customerId"
      @changed="handleBusinessChanged"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import CustomerBusinessDialogs from '../components/customers/CustomerBusinessDialogs.vue'
import {
  useAuthStore,
  useQuery,
  getCustomer,
  transferCustomer,
  releaseCustomer,
  claimCustomer,
  createClaim,
  addContact,
  listCustomerAssignees,
  CUSTOMER_STATUS_OPTIONS,
  type CustomerStatus,
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
const showAddContact = ref(false)
const acting = ref(false)
const businessDialogs = ref<InstanceType<typeof CustomerBusinessDialogs>>()

const transferForm = reactive({ toOwnerId: '', reason: '' })
const releaseForm = reactive({ target: 'pool' as 'pool' | 'invalid', reason: '' })
const claimReason = ref('')
const contactForm = reactive({ name: '', title: '', phone: '', isKeyContact: false })

const isOwner = computed(() => detail.value?.ownerId === auth.user?.id)
const isPublic = computed(() => detail.value?.status === 'public')
const availableAssignees = computed(
  () => assignees.value?.filter((user) => user.id !== detail.value?.ownerId) ?? [],
)

function statusLabel(status: CustomerStatus): string {
  return CUSTOMER_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
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

async function handleAddContact() {
  if (!contactForm.phone) return ElMessage.warning('电话必填')
  await runAction(
    () =>
      addContact(customerId, {
        name: contactForm.name || undefined,
        title: contactForm.title || undefined,
        phone: contactForm.phone,
        isKeyContact: contactForm.isKeyContact,
      }),
    '联系人已添加',
  )
  showAddContact.value = false
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
.detail__contacts-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.detail__dialog-alert {
  margin-bottom: var(--crm-spacing-md);
}
</style>
