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
        <van-field
          v-model="industryLabel"
          label="客户行业"
          readonly
          is-link
          placeholder="选择客户行业"
          @click="showIndustry = true"
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
          v-model="gradeLabel"
          label="客户等级"
          readonly
          is-link
          @click="showGrade = true"
        />
      </van-cell-group>

      <van-cell-group inset title="首要联系人" class="customer-form__section">
        <van-field v-model="form.contactName" label="姓名" placeholder="可稍后完善" />
        <van-field
          v-model="form.contactPhone"
          label="联系电话"
          type="tel"
          placeholder="至少填写一个联系电话"
          :rules="[{ required: true, message: '请输入联系电话' }]"
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
    <van-popup v-model:show="showSegment" position="bottom" round>
      <van-picker :columns="segmentColumns" @confirm="pickSegment" @cancel="showSegment = false" />
    </van-popup>
    <van-popup v-model:show="showGrade" position="bottom" round>
      <van-picker :columns="gradeColumns" @confirm="pickGrade" @cancel="showGrade = false" />
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
  listCities,
  listDimensionOptions,
  listProvinces,
  type AdministrativeDivision,
  type CustomerGrade,
  type DimensionOption,
} from '@crm/domain'

interface PickerOption {
  text: string
  value: string
}

const router = useRouter()
const form = reactive({
  name: '',
  provinceCode: '',
  cityCode: '',
  industry: '',
  subIndustry: '',
  grade: 'C' as CustomerGrade,
  contactName: '',
  contactPhone: '',
  notes: '',
})
const provinces = ref<AdministrativeDivision[]>([])
const cities = ref<AdministrativeDivision[]>([])
const industries = ref<DimensionOption[]>([])
const segments = ref<DimensionOption[]>([])
const saving = ref(false)
const showProvince = ref(false)
const showCity = ref(false)
const showIndustry = ref(false)
const showSegment = ref(false)
const showGrade = ref(false)

const provinceColumns = computed(() =>
  provinces.value.map((item) => ({ text: item.name, value: item.code })),
)
const cityColumns = computed(() =>
  cities.value.map((item) => ({ text: item.name, value: item.code })),
)
const industryColumns = computed(() =>
  industries.value.map((item) => ({ text: item.label, value: item.name })),
)
const segmentColumns = computed(() =>
  segments.value.map((item) => ({ text: item.label, value: item.name })),
)
const gradeColumns = CUSTOMER_GRADE_OPTIONS.map((grade) => ({ text: `${grade} 级`, value: grade }))
const provinceLabel = computed(
  () => provinces.value.find((item) => item.code === form.provinceCode)?.name ?? '',
)
const cityLabel = computed(
  () => cities.value.find((item) => item.code === form.cityCode)?.name ?? '',
)
const industryLabel = computed(
  () => industries.value.find((item) => item.name === form.industry)?.label ?? '',
)
const segmentLabel = computed(
  () => segments.value.find((item) => item.name === form.subIndustry)?.label ?? '',
)
const gradeLabel = computed(() => `${form.grade} 级`)

onMounted(async () => {
  const [provinceOptions, industryOptions, segmentOptions] = await Promise.all([
    listProvinces(),
    listDimensionOptions('industry'),
    listDimensionOptions('sub_industry'),
  ])
  provinces.value = provinceOptions
  industries.value = industryOptions.filter((item) => item.isActive)
  segments.value = segmentOptions.filter((item) => item.isActive)
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
  showIndustry.value = false
}
function pickSegment({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.subIndustry = selectedOptions[0].value
  showSegment.value = false
}
function pickGrade({ selectedOptions }: { selectedOptions: PickerOption[] }) {
  form.grade = selectedOptions[0].value as CustomerGrade
  showGrade.value = false
}

async function submit() {
  saving.value = true
  try {
    const hits = await checkDuplicate({
      name: form.name.trim(),
      phone: form.contactPhone.trim(),
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
      industry: form.industry || undefined,
      subIndustry: form.subIndustry || undefined,
      grade: form.grade,
      notes: form.notes.trim() || undefined,
      contacts: [
        {
          name: form.contactName.trim() || undefined,
          phone: form.contactPhone.trim(),
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
</style>
