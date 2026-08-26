<template>
  <div class="create-customer">
    <AppPageHeader
      title="新建客户"
      description="先查重，再建立客户和首要联系人"
      back-to="/customers"
      back-label="客户列表"
    />

    <el-card class="create-customer__card">
      <el-form :model="form" label-width="90px">
        <el-form-item label="客户名称" required>
          <el-input v-model="form.name" placeholder="如：上海华明机械有限公司" />
        </el-form-item>

        <el-form-item label="城市">
          <el-input v-model="form.city" placeholder="城市" />
        </el-form-item>

        <el-form-item label="产业">
          <el-select v-model="form.industry" clearable placeholder="选择产业" style="width: 100%">
            <el-option v-for="o in industries" :key="o.id" :label="o.label" :value="o.name" />
          </el-select>
        </el-form-item>

        <el-form-item label="等级">
          <el-select v-model="form.grade" style="width: 120px">
            <el-option v-for="g in CUSTOMER_GRADE_OPTIONS" :key="g" :label="g" :value="g" />
          </el-select>
        </el-form-item>

        <el-form-item label="指定负责人">
          <el-select
            v-model="form.ownerId"
            clearable
            filterable
            :placeholder="canOwnCustomer ? '留空则由本人负责' : '请选择客户负责人'"
            style="width: 100%"
          >
            <el-option
              v-for="user in assignees"
              :key="user.id"
              :label="`${user.displayName}${user.region ? ` · ${user.region}` : ''}`"
              :value="user.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="联系人" required>
          <div class="create-customer__contacts">
            <div v-for="(c, i) in form.contacts" :key="i" class="create-customer__contact-row">
              <el-input v-model="c.name" placeholder="姓名（可空）" style="width: 140px" />
              <el-input v-model="c.phone" placeholder="电话（必填）" style="width: 160px" />
              <el-button link type="danger" @click="form.contacts.splice(i, 1)">删除</el-button>
            </div>
            <el-button size="small" @click="form.contacts.push({ name: '', phone: '' })">
              + 添加联系人
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" />
        </el-form-item>

        <!-- 查重提示（§8.2 疑似重复列表） -->
        <el-alert
          v-if="dedupHits.length"
          type="warning"
          :closable="false"
          class="create-customer__dedup"
        >
          <div class="create-customer__dedup-title">检测到疑似重复客户：</div>
          <div v-for="h in dedupHits" :key="h.candidateId" class="create-customer__dedup-row">
            <span>{{ h.candidateName }}（{{ h.candidateCity ?? '未知城市' }}）</span>
            <el-tag
              size="small"
              :type="
                h.confidence === 'high' ? 'danger' : h.confidence === 'medium' ? 'warning' : 'info'
              "
            >
              {{ DEDUP_CONFIDENCE_LABELS[h.confidence] }}
            </el-tag>
            <span class="create-customer__dedup-reason">{{ h.reasons.join('；') }}</span>
          </div>
          <el-button
            v-if="auth.hasAbility('customer.transfer') && firstHit"
            size="small"
            type="primary"
            plain
            @click="applyClaim(firstHit)"
          >
            申请接管
          </el-button>
        </el-alert>

        <el-form-item>
          <el-button type="primary" :loading="saving" @click="handleSubmit">提交</el-button>
          <el-button @click="handleDedupCheck">查重</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import {
  useAuthStore,
  checkDuplicate,
  createCustomer,
  createClaim,
  listDimensionOptions,
  listCustomerAssignees,
  CUSTOMER_GRADE_OPTIONS,
  DEDUP_CONFIDENCE_LABELS,
  type DedupHit,
  type DimensionOption,
  type CustomerGrade,
  type AssigneeOption,
} from '@crm/domain'

const router = useRouter()
const auth = useAuthStore()

const form = reactive({
  name: '',
  city: '',
  industry: undefined as string | undefined,
  grade: 'C',
  ownerId: '',
  notes: '',
  contacts: [{ name: '', phone: '' } as { name?: string; phone?: string }],
})
const industries = ref<DimensionOption[]>([])
const assignees = ref<AssigneeOption[]>([])
const dedupHits = ref<DedupHit[]>([])
const saving = ref(false)

const firstHit = computed(() => dedupHits.value[0])
const canOwnCustomer = computed(() => ['sales', 'executive'].includes(auth.user?.role ?? ''))

onMounted(async () => {
  const [industryOptions, assigneeOptions] = await Promise.all([
    listDimensionOptions('industry').catch(() => []),
    auth.hasAbility('customer.transfer') ? listCustomerAssignees().catch(() => []) : [],
  ])
  industries.value = industryOptions.filter((option) => option.isActive)
  assignees.value = assigneeOptions
})

async function handleDedupCheck() {
  if (!form.name.trim()) {
    ElMessage.warning('请先填写客户名称')
    return
  }
  const phone = form.contacts.find((c) => c.phone?.trim())?.phone
  dedupHits.value = await checkDuplicate({ name: form.name.trim(), phone }).catch(() => [])
  if (dedupHits.value.length === 0) ElMessage.success('未发现疑似重复')
}

async function handleSubmit() {
  if (!form.name.trim()) return ElMessage.warning('客户名称必填')
  if (!form.ownerId && !canOwnCustomer.value) return ElMessage.warning('请选择客户负责人')
  const phone = form.contacts.find((c) => c.phone?.trim())?.phone
  if (!phone) return ElMessage.warning('至少需要一个联系人电话')

  // 提交前查重（§8.2 疑似提示）
  dedupHits.value = await checkDuplicate({ name: form.name.trim(), phone }).catch(() => [])
  if (dedupHits.value.some((h) => h.confidence === 'high')) {
    try {
      await ElMessageBox.confirm('检测到高度疑似重复客户，仍要新建吗？', '查重提示', {
        type: 'warning',
        confirmButtonText: '仍要新建',
      })
    } catch {
      return
    }
  }

  saving.value = true
  try {
    await createCustomer({
      name: form.name.trim(),
      city: form.city || undefined,
      industry: form.industry,
      grade: form.grade as CustomerGrade,
      ownerId: form.ownerId || undefined,
      notes: form.notes || undefined,
      contacts: form.contacts
        .filter((c) => c.phone?.trim())
        .map((c) => ({ name: c.name?.trim() || undefined, phone: c.phone?.trim() })),
    })
    ElMessage.success('建档成功')
    void router.push('/customers')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '建档失败')
  } finally {
    saving.value = false
  }
}

async function applyClaim(hit?: DedupHit) {
  if (!hit) return
  try {
    await createClaim(hit.candidateId, `查重发现疑似重复，申请接管「${hit.candidateName}」`)
    ElMessage.success('接管申请已提交')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '申请失败')
  }
}
</script>

<style scoped>
.create-customer {
  padding: var(--crm-spacing-xl);
}
.create-customer__card {
  max-width: 640px;
}
.create-customer__contacts {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--crm-spacing-sm);
}
.create-customer__contact-row {
  display: flex;
  gap: var(--crm-spacing-sm);
  align-items: center;
}
.create-customer__dedup {
  margin-bottom: var(--crm-spacing-md);
}
.create-customer__dedup-title {
  font-weight: 600;
  margin-bottom: var(--crm-spacing-sm);
}
.create-customer__dedup-row {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-sm);
  padding: var(--crm-spacing-xs) 0;
}
.create-customer__dedup-reason {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
</style>
