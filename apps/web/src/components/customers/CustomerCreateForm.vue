<template>
  <el-form :model="form" label-width="90px" class="customer-create-form">
    <el-form-item label="客户名称" required>
      <el-input v-model="form.name" placeholder="如：上海华明机械有限公司" />
    </el-form-item>

    <el-form-item label="省 / 地级市">
      <div class="customer-create-form__location">
        <el-select v-model="form.provinceCode" clearable filterable placeholder="选择省份">
          <el-option
            v-for="item in provinces"
            :key="item.code"
            :label="item.name"
            :value="item.code"
          />
        </el-select>
        <el-select
          v-model="form.cityCode"
          clearable
          filterable
          :disabled="!form.provinceCode"
          placeholder="选择地级市"
        >
          <el-option
            v-for="item in cities"
            :key="item.code"
            :label="item.name"
            :value="item.code"
          />
        </el-select>
      </div>
    </el-form-item>

    <el-form-item label="客户行业">
      <el-select v-model="form.industry" clearable placeholder="选择产业" style="width: 100%">
        <el-option v-for="o in industries" :key="o.id" :label="o.label" :value="o.name" />
      </el-select>
    </el-form-item>

    <el-form-item label="具体领域">
      <el-select
        v-model="form.subIndustry"
        clearable
        placeholder="选择具体领域"
        style="width: 100%"
      >
        <el-option v-for="o in businessSegments" :key="o.id" :label="o.label" :value="o.name" />
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
      <div class="customer-create-form__contacts">
        <div
          v-for="(contact, index) in form.contacts"
          :key="index"
          class="customer-create-form__contact-row"
        >
          <el-input v-model="contact.name" placeholder="姓名（可空）" />
          <el-input v-model="contact.title" placeholder="职务（原文）" />
          <el-select v-model="contact.functionRole" clearable placeholder="岗位类别">
            <el-option
              v-for="option in contactFunctions"
              :key="option.name"
              :label="option.label"
              :value="option.name"
            />
          </el-select>
          <el-input v-model="contact.phone" placeholder="电话（必填）" />
          <el-button link type="danger" @click="form.contacts.splice(index, 1)">删除</el-button>
        </div>
        <el-button
          size="small"
          @click="form.contacts.push({ name: '', title: '', functionRole: '', phone: '' })"
        >
          + 添加联系人
        </el-button>
      </div>
    </el-form-item>

    <el-form-item label="备注">
      <el-input v-model="form.notes" type="textarea" :rows="2" />
    </el-form-item>

    <el-alert
      v-if="dedupHits.length"
      type="warning"
      :closable="false"
      class="customer-create-form__dedup"
    >
      <div class="customer-create-form__dedup-title">检测到疑似重复客户：</div>
      <div v-for="hit in dedupHits" :key="hit.candidateId" class="customer-create-form__dedup-row">
        <span>{{ hit.candidateName }}（{{ hit.candidateCity ?? '未知城市' }}）</span>
        <el-tag size="small" effect="plain">{{ customerStatusLabel(hit.customerStatus) }}</el-tag>
        <el-tag
          size="small"
          :type="
            hit.confidence === 'high' ? 'danger' : hit.confidence === 'medium' ? 'warning' : 'info'
          "
        >
          {{ DEDUP_CONFIDENCE_LABELS[hit.confidence] }}
        </el-tag>
        <span class="customer-create-form__dedup-reason">{{ hit.reasons.join('；') }}</span>
      </div>
      <el-button
        v-if="auth.hasAbility('customer.transfer') && firstHit?.customerStatus === 'active'"
        size="small"
        type="primary"
        plain
        @click="applyClaim(firstHit)"
      >
        申请接管
      </el-button>
      <el-button
        v-if="firstHit?.customerStatus === 'public' && auth.hasAbility('customer.write')"
        size="small"
        type="success"
        plain
        @click="claimPoolCustomer(firstHit)"
      >
        认领公海客户
      </el-button>
    </el-alert>

    <el-form-item>
      <el-button type="primary" :loading="saving" @click="handleSubmit">提交</el-button>
      <el-button @click="handleDedupCheck">查重</el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  useAuthStore,
  checkDuplicate,
  createCustomer,
  createClaim,
  listDimensionOptions,
  listCustomerAssignees,
  listCities,
  listProvinces,
  CUSTOMER_GRADE_OPTIONS,
  DEDUP_CONFIDENCE_LABELS,
  type DedupHit,
  claimCustomer,
  type DimensionOption,
  type CustomerGrade,
  type AssigneeOption,
  type AdministrativeDivision,
  type CustomerItem,
} from '@crm/domain'

const emit = defineEmits<{
  created: [customer: CustomerItem]
  claimed: [customerId: string]
}>()

const auth = useAuthStore()
const form = reactive({
  name: '',
  provinceCode: '',
  cityCode: '',
  industry: undefined as string | undefined,
  subIndustry: undefined as string | undefined,
  grade: 'C',
  ownerId: '',
  notes: '',
  contacts: [
    { name: '', title: '', functionRole: '', phone: '' } as {
      name?: string
      title?: string
      functionRole?: string
      phone?: string
    },
  ],
})
const industries = ref<DimensionOption[]>([])
const businessSegments = ref<DimensionOption[]>([])
const contactFunctions = ref<DimensionOption[]>([])
const provinces = ref<AdministrativeDivision[]>([])
const cities = ref<AdministrativeDivision[]>([])
const assignees = ref<AssigneeOption[]>([])
const dedupHits = ref<DedupHit[]>([])
const saving = ref(false)

const firstHit = computed(() => dedupHits.value[0])
const canOwnCustomer = computed(() => ['sales', 'executive'].includes(auth.user?.role ?? ''))

onMounted(async () => {
  const [industryOptions, segmentOptions, functionOptions, provinceOptions, assigneeOptions] =
    await Promise.all([
      listDimensionOptions('industry').catch(() => []),
      listDimensionOptions('sub_industry').catch(() => []),
      listDimensionOptions('contact_function').catch(() => []),
      listProvinces().catch(() => []),
      auth.hasAbility('customer.transfer') ? listCustomerAssignees().catch(() => []) : [],
    ])
  industries.value = industryOptions.filter((option) => option.isActive)
  businessSegments.value = segmentOptions.filter((option) => option.isActive)
  contactFunctions.value = functionOptions.filter((option) => option.isActive)
  provinces.value = provinceOptions
  assignees.value = assigneeOptions
})

watch(
  () => form.provinceCode,
  async (provinceCode) => {
    form.cityCode = ''
    cities.value = provinceCode ? await listCities(provinceCode).catch(() => []) : []
  },
)

async function handleDedupCheck() {
  if (!form.name.trim()) return ElMessage.warning('请先填写客户名称')
  const phone = form.contacts.find((contact) => contact.phone?.trim())?.phone
  dedupHits.value = await checkDuplicate({ name: form.name.trim(), phone }).catch(() => [])
  if (dedupHits.value.length === 0) ElMessage.success('未发现疑似重复')
}

async function handleSubmit() {
  if (!form.name.trim()) return ElMessage.warning('客户名称必填')
  if (!form.ownerId && !canOwnCustomer.value) return ElMessage.warning('请选择客户负责人')
  const phone = form.contacts.find((contact) => contact.phone?.trim())?.phone
  if (!phone) return ElMessage.warning('至少需要一个联系人电话')

  dedupHits.value = await checkDuplicate({ name: form.name.trim(), phone }).catch(() => [])
  if (dedupHits.value.some((hit) => hit.confidence === 'high')) {
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
    const customer = await createCustomer({
      name: form.name.trim(),
      provinceCode: form.provinceCode || undefined,
      cityCode: form.cityCode || undefined,
      industry: form.industry,
      subIndustry: form.subIndustry,
      grade: form.grade as CustomerGrade,
      ownerId: form.ownerId || undefined,
      notes: form.notes || undefined,
      contacts: form.contacts
        .filter((contact) => contact.phone?.trim())
        .map((contact) => ({
          name: contact.name?.trim() || undefined,
          title: contact.title?.trim() || undefined,
          functionRole: contact.functionRole || undefined,
          phone: contact.phone?.trim(),
        })),
    })
    ElMessage.success('建档成功')
    emit('created', customer)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '建档失败')
  } finally {
    saving.value = false
  }
}

async function applyClaim(hit?: DedupHit) {
  if (!hit) return
  try {
    await createClaim(hit.candidateId, `查重发现疑似重复，申请接管「${hit.candidateName}」`)
    ElMessage.success('接管申请已提交')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '申请失败')
  }
}

async function claimPoolCustomer(hit?: DedupHit) {
  if (!hit) return
  try {
    await claimCustomer(hit.candidateId)
    ElMessage.success('公海客户已认领')
    emit('claimed', hit.candidateId)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '认领失败')
  }
}

function customerStatusLabel(status?: DedupHit['customerStatus']) {
  return status === 'public' ? '公海' : status === 'invalid' ? '无效档案' : '在案'
}
</script>

<style scoped>
.customer-create-form__contacts {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: var(--crm-spacing-sm);
}
.customer-create-form__location {
  display: grid;
  width: 100%;
  grid-template-columns: 1fr 1fr;
  gap: var(--crm-spacing-sm);
}
.customer-create-form__contact-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(120px, 1fr) minmax(130px, 1fr) 160px auto;
  align-items: center;
  gap: var(--crm-spacing-sm);
}
.customer-create-form__dedup {
  margin-bottom: var(--crm-spacing-md);
}
.customer-create-form__dedup-title {
  margin-bottom: var(--crm-spacing-sm);
  font-weight: 600;
}
.customer-create-form__dedup-row {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-sm);
  padding: var(--crm-spacing-xs) 0;
}
.customer-create-form__dedup-reason {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
</style>
