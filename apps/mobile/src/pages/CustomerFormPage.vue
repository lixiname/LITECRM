<template>
  <div class="customer-form">
    <van-nav-bar title="新建客户" left-arrow @click-left="router.back()" />

    <van-form @submit="submit">
      <van-cell-group inset title="客户档案">
        <van-field
          v-model="form.name"
          label="客户名称"
          placeholder="请输入完整客户名称"
          :rules="[{ required: true, message: '请输入客户名称' }]"
        />
        <van-field
          v-model="provinceLabel"
          label="省份"
          readonly
          is-link
          placeholder="选择省份"
          @click="showProvince = true"
        />
        <van-field
          v-model="cityLabel"
          label="地级市"
          readonly
          is-link
          :disabled="!form.provinceCode"
          placeholder="选择地级市"
          @click="form.provinceCode && (showCity = true)"
        />
        <van-field v-model="form.address" label="详细地址" placeholder="工业园、道路及门牌等" />
        <van-field
          v-model="customerTypeLabel"
          label="客户类型"
          readonly
          is-link
          placeholder="选择终端用户、设备商等类型"
          @click="showCustomerType = true"
        />
        <van-field
          v-model="sourceLabel"
          label="客户来源"
          readonly
          is-link
          placeholder="选择陌拜、展会等来源"
          @click="showSource = true"
        />
        <van-field
          v-model="industryLabel"
          label="客户行业"
          readonly
          is-link
          placeholder="选择客户行业"
          @click="showIndustry = true"
        />
        <van-field
          v-if="form.industry === 'other'"
          v-model="form.industryOtherText"
          label="其他客户行业"
          placeholder="填写具体行业"
          required
          maxlength="80"
          show-word-limit
          :rules="[{ required: true, message: '请填写具体客户行业' }]"
        />
        <van-field
          v-model="segmentLabel"
          label="具体领域"
          readonly
          is-link
          placeholder="选择具体领域"
          @click="showSegment = true"
        />
        <van-field
          v-if="form.subIndustry === 'other'"
          v-model="form.subIndustryOtherText"
          label="其他具体领域"
          placeholder="填写具体领域"
          required
          maxlength="80"
          show-word-limit
          :rules="[{ required: true, message: '请填写具体领域' }]"
        />
        <van-field
          v-model="productLinesLabel"
          label="产品线"
          readonly
          is-link
          placeholder="可多选"
          @click="showProductLines = true"
        />
        <van-field
          v-model="gradeLabel"
          label="客户等级"
          readonly
          is-link
          @click="showGrade = true"
        />
        <van-field
          v-if="showOwnerField"
          v-model="ownerLabel"
          label="负责人"
          readonly
          is-link
          :required="ownerRequired"
          :placeholder="ownerRequired ? '请选择客户负责人' : '默认本人负责'"
          @click="showOwner = true"
        />
      </van-cell-group>

      <van-cell-group inset title="首要联系人" class="customer-form__section">
        <van-field v-model="form.contactName" label="姓名" placeholder="可稍后完善" />
        <van-field v-model="form.contactTitle" label="职务" placeholder="如：动力设备科副科长" />
        <van-field
          v-model="contactFunctionLabel"
          label="岗位类别"
          readonly
          is-link
          placeholder="采购、技术、设备等"
          @click="showContactFunction = true"
        />
        <van-field
          v-model="form.contactPhone"
          label="联系电话"
          type="tel"
          placeholder="与微信号至少填写一项"
        />
        <van-field
          v-model="form.contactWechatId"
          label="微信号"
          placeholder="可搜索的微信号，不填微信昵称"
        />
      </van-cell-group>

      <van-cell-group inset title="补充信息" class="customer-form__section">
        <van-field
          v-model="form.notes"
          label="备注"
          type="textarea"
          rows="3"
          autosize
          maxlength="300"
          show-word-limit
        />
      </van-cell-group>

      <div class="customer-form__submit">
        <van-button block round type="primary" native-type="submit" :loading="saving">
          查重并建档
        </van-button>
      </div>
    </van-form>

    <van-popup v-model:show="showProvince" position="bottom" round>
      <van-picker
        :columns="provinceColumns"
        @confirm="pickProvince"
        @cancel="showProvince = false"
      />
    </van-popup>
    <van-popup v-model:show="showCity" position="bottom" round>
      <van-picker :columns="cityColumns" @confirm="pickCity" @cancel="showCity = false" />
    </van-popup>
    <van-popup v-model:show="showIndustry" position="bottom" round>
      <van-picker
        :columns="industryColumns"
        @confirm="pickIndustry"
        @cancel="showIndustry = false"
      />
    </van-popup>
    <van-popup v-model:show="showCustomerType" position="bottom" round>
      <van-picker
        :columns="customerTypeColumns"
        @confirm="pickCustomerType"
        @cancel="showCustomerType = false"
      />
    </van-popup>
    <van-popup v-model:show="showSource" position="bottom" round>
      <van-picker :columns="sourceColumns" @confirm="pickSource" @cancel="showSource = false" />
    </van-popup>
    <van-popup v-model:show="showSegment" position="bottom" round>
      <van-picker :columns="segmentColumns" @confirm="pickSegment" @cancel="showSegment = false" />
    </van-popup>
    <van-popup v-model:show="showGrade" position="bottom" round>
      <van-picker :columns="gradeColumns" @confirm="pickGrade" @cancel="showGrade = false" />
    </van-popup>
    <van-popup v-model:show="showContactFunction" position="bottom" round>
      <van-picker
        :columns="contactFunctionColumns"
        @confirm="pickContactFunction"
        @cancel="showContactFunction = false"
      />
    </van-popup>
    <van-popup v-model:show="showOwner" position="bottom" round>
      <van-picker :columns="ownerColumns" @confirm="pickOwner" @cancel="showOwner = false" />
    </van-popup>
    <van-popup v-model:show="showProductLines" position="bottom" round>
      <div class="customer-form__multi-picker">
        <h3>选择产品线</h3>
        <van-checkbox-group v-model="form.productLines">
          <van-checkbox v-for="option in productLines" :key="option.name" :name="option.name">
            {{ option.label }}
          </van-checkbox>
        </van-checkbox-group>
        <van-button block round type="primary" @click="showProductLines = false">完成</van-button>
      </div>
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { showConfirmDialog, showToast } from 'vant'
import {
  CUSTOMER_GRADE_OPTIONS,
  checkDuplicate,
  createCustomer,
  listCustomerAssignees,
  listCities,
  listDimensionOptions,
  listProvinces,
  useAuthStore,
  type AdministrativeDivision,
  type AssigneeOption,
  type CustomerGrade,
  type DimensionOption,
} from '@crm/domain'

interface PickerOption {
  text: string
  value: string
}

const router = useRouter()
const auth = useAuthStore()
const form = reactive({
  name: '',
  provinceCode: '',
  cityCode: '',
  address: '',
  customerType: '',
  source: '',
  industry: '',
  industryOtherText: '',
  subIndustry: '',
  subIndustryOtherText: '',
  productLines: [] as string[],
  grade: 'C' as CustomerGrade,
  ownerId: '',
  contactName: '',
  contactTitle: '',
  contactFunction: '',
  contactPhone: '',
  contactWechatId: '',
  notes: '',
})
const provinces = ref<AdministrativeDivision[]>([])
const cities = ref<AdministrativeDivision[]>([])
const industries = ref<DimensionOption[]>([])
const segments = ref<DimensionOption[]>([])
const customerTypes = ref<DimensionOption[]>([])
const sources = ref<DimensionOption[]>([])
const productLines = ref<DimensionOption[]>([])
const contactFunctions = ref<DimensionOption[]>([])
const assignees = ref<AssigneeOption[]>([])
const saving = ref(false)
const showProvince = ref(false)
const showCity = ref(false)
const showIndustry = ref(false)
const showCustomerType = ref(false)
const showSource = ref(false)
const showSegment = ref(false)
const showGrade = ref(false)
const showProductLines = ref(false)
const showContactFunction = ref(false)
const showOwner = ref(false)

const provinceColumns = computed(() =>
  provinces.value.map((item) => ({ text: item.name, value: item.code })),
)
const cityColumns = computed(() =>
  cities.value.map((item) => ({ text: item.name, value: item.code })),
)
const industryColumns = computed(() =>
  industries.value.map((item) => ({ text: item.label, value: item.name })),
)
const customerTypeColumns = computed(() =>
  customerTypes.value.map((item) => ({ text: item.label, value: item.name })),
)
const sourceColumns = computed(() =>
  sources.value.map((item) => ({ text: item.label, value: item.name })),
)
const segmentColumns = computed(() =>
  segments.value.map((item) => ({ text: item.label, value: item.name })),
)
const gradeColumns = CUSTOMER_GRADE_OPTIONS.map((grade) => ({ text: `${grade} 级`, value: grade }))
const contactFunctionColumns = computed(() =>
  contactFunctions.value.map((item) => ({ text: item.label, value: item.name })),
)
const canOwnCustomer = computed(() => ['sales', 'executive'].includes(auth.user?.role ?? ''))
const showOwnerField = computed(() => auth.hasAbility('customer.transfer') || !canOwnCustomer.value)
const ownerRequired = computed(() => !canOwnCustomer.value)
const ownerColumns = computed(() => [
  ...(canOwnCustomer.value ? [{ text: '本人负责', value: '' }] : []),
  ...assignees.value.map((item) => ({
    text: `${item.displayName}${item.region ? ` · ${item.region}` : ''}`,
    value: item.id,
  })),
])
const provinceLabel = computed(
  () => provinces.value.find((item) => item.code === form.provinceCode)?.name ?? '',
)
const cityLabel = computed(
  () => cities.value.find((item) => item.code === form.cityCode)?.name ?? '',
)
const industryLabel = computed(
  () => industries.value.find((item) => item.name === form.industry)?.label ?? '',
)
const customerTypeLabel = computed(
  () => customerTypes.value.find((item) => item.name === form.customerType)?.label ?? '',
)
const sourceLabel = computed(
  () => sources.value.find((item) => item.name === form.source)?.label ?? '',
)
const segmentLabel = computed(
  () => segments.value.find((item) => item.name === form.subIndustry)?.label ?? '',
)
const productLinesLabel = computed(() =>
  form.productLines
    .map((value) => productLines.value.find((item) => item.name === value)?.label ?? value)
    .join('、'),
)
const gradeLabel = computed(() => `${form.grade} 级`)
const contactFunctionLabel = computed(
  () => contactFunctions.value.find((item) => item.name === form.contactFunction)?.label ?? '',
)
const ownerLabel = computed(() => {
  if (!form.ownerId) return canOwnCustomer.value ? '本人负责' : ''
  return assignees.value.find((item) => item.id === form.ownerId)?.displayName ?? ''
})

onMounted(async () => {
  const [
    provinceOptions,
    industryOptions,
    segmentOptions,
    customerTypeOptions,
    sourceOptions,
    productLineOptions,
    contactFunctionOptions,
    assigneeOptions,
  ] = await Promise.all([
    listProvinces().catch(() => []),
    listDimensionOptions('industry').catch(() => []),
    listDimensionOptions('sub_industry').catch(() => []),
    listDimensionOptions('customer_type').catch(() => []),
    listDimensionOptions('source').catch(() => []),
    listDimensionOptions('product_line').catch(() => []),
    listDimensionOptions('contact_function').catch(() => []),
    showOwnerField.value ? listCustomerAssignees().catch(() => []) : [],
  ])
  provinces.value = provinceOptions
  industries.value = industryOptions.filter((item) => item.isActive)
  segments.value = segmentOptions.filter((item) => item.isActive)
  customerTypes.value = customerTypeOptions.filter((item) => item.isActive)
  sources.value = sourceOptions.filter((item) => item.isActive)
  productLines.value = productLineOptions.filter((item) => item.isActive)
  contactFunctions.value = contactFunctionOptions.filter((item) => item.isActive)
  assignees.value = assigneeOptions
})

async function pickProvince({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.provinceCode = selectedOptions[0].value
  form.cityCode = ''
  cities.value = await listCities(form.provinceCode)
  showProvince.value = false
}
function pickCity({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.cityCode = selectedOptions[0].value
  showCity.value = false
}
function pickIndustry({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.industry = selectedOptions[0].value
  if (form.industry !== 'other') form.industryOtherText = ''
  showIndustry.value = false
}
function pickCustomerType({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.customerType = selectedOptions[0].value
  showCustomerType.value = false
}
function pickSource({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.source = selectedOptions[0].value
  showSource.value = false
}
function pickSegment({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.subIndustry = selectedOptions[0].value
  if (form.subIndustry !== 'other') form.subIndustryOtherText = ''
  showSegment.value = false
}
function pickGrade({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.grade = selectedOptions[0].value as CustomerGrade
  showGrade.value = false
}
function pickContactFunction({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.contactFunction = selectedOptions[0].value
  showContactFunction.value = false
}
function pickOwner({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.ownerId = selectedOptions[0].value
  showOwner.value = false
}

async function submit() {
  if (form.industry === 'other' && !form.industryOtherText.trim())
    return showToast('请填写具体客户行业')
  if (form.subIndustry === 'other' && !form.subIndustryOtherText.trim())
    return showToast('请填写具体领域')
  if (ownerRequired.value && !form.ownerId) {
    showToast('请选择客户负责人')
    return
  }
  if (!form.contactPhone.trim() && !form.contactWechatId.trim()) {
    showToast('联系电话和微信号至少填写一项')
    return
  }
  saving.value = true
  try {
    const hits = await checkDuplicate({
      name: form.name.trim(),
      phone: form.contactPhone.trim() || undefined,
      wechatId: form.contactWechatId.trim() || undefined,
    })
    if (hits.some((item) => item.confidence === 'high')) {
      await showConfirmDialog({
        title: '发现高度疑似客户',
        message: `可能与“${hits[0].candidateName}”重复。仍要继续建档吗？`,
        confirmButtonText: '仍要建档',
      })
    }
    const created = await createCustomer({
      name: form.name.trim(),
      provinceCode: form.provinceCode || undefined,
      cityCode: form.cityCode || undefined,
      address: form.address.trim() || undefined,
      customerType: form.customerType || undefined,
      source: form.source || undefined,
      industry: form.industry || undefined,
      industryOtherText: form.industry === 'other' ? form.industryOtherText.trim() : undefined,
      subIndustry: form.subIndustry || undefined,
      subIndustryOtherText:
        form.subIndustry === 'other' ? form.subIndustryOtherText.trim() : undefined,
      productLines: form.productLines,
      grade: form.grade,
      ownerId: form.ownerId || undefined,
      notes: form.notes.trim() || undefined,
      contacts: [
        {
          name: form.contactName.trim() || undefined,
          title: form.contactTitle.trim() || undefined,
          functionRole: form.contactFunction || undefined,
          phone: form.contactPhone.trim() || undefined,
          wechatId: form.contactWechatId.trim() || undefined,
          isKeyContact: true,
        },
      ],
    })
    showToast('客户建档成功')
    await router.replace(`/customers/${created.id}`)
  } catch (error) {
    if (error instanceof Error && error.message) showToast(error.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.customer-form {
  min-height: 100vh;
  padding-bottom: 32px;
  background: var(--crm-color-bg-page);
}
.customer-form__section {
  margin-top: var(--crm-spacing-md);
}
.customer-form__submit {
  padding: var(--crm-spacing-xl) var(--crm-spacing-md);
}
.customer-form__multi-picker {
  min-width: min(100vw, 480px);
  padding: var(--crm-spacing-lg);
}
.customer-form__multi-picker h3 {
  margin: 0 0 var(--crm-spacing-lg);
  text-align: center;
}
.customer-form__multi-picker :deep(.van-checkbox-group) {
  display: grid;
  gap: var(--crm-spacing-lg);
  margin-bottom: var(--crm-spacing-xl);
}
</style>
