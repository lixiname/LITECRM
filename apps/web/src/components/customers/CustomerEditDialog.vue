<template>
  <el-dialog v-model="visible" title="编辑客户资料" width="760px" destroy-on-close>
    <el-form label-width="110px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="客户名称" required><el-input v-model="form.name" /></el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户等级">
            <el-select v-model="form.grade" style="width: 100%">
              <el-option
                v-for="grade in CUSTOMER_GRADE_OPTIONS"
                :key="grade"
                :label="grade"
                :value="grade"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="ERP 客户编码"><el-input v-model="form.customerCode" /></el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="信用代码"
            ><el-input v-model="form.unifiedSocialCreditCode"
          /></el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="省份"><el-input v-model="form.province" /></el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="城市"><el-input v-model="form.city" /></el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="产业">
            <el-select v-model="form.industry" clearable filterable style="width: 100%">
              <el-option
                v-for="option in options.industry"
                :key="option.id"
                :label="option.label"
                :value="option.name"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="二级行业"><el-input v-model="form.subIndustry" /></el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户类型">
            <el-select v-model="form.customerType" clearable style="width: 100%">
              <el-option
                v-for="option in options.customer_type"
                :key="option.id"
                :label="option.label"
                :value="option.name"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="客户来源">
            <el-select v-model="form.source" clearable style="width: 100%">
              <el-option
                v-for="option in options.source"
                :key="option.id"
                :label="option.label"
                :value="option.name"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="关注产品线">
            <el-select v-model="form.productLines" multiple clearable style="width: 100%">
              <el-option
                v-for="option in options.product_line"
                :key="option.id"
                :label="option.label"
                :value="option.name"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="网址"><el-input v-model="form.website" /></el-form-item>
        </el-col>
        <el-col v-if="form.grade !== customer.grade" :span="24">
          <el-form-item label="调级原因" required>
            <el-input v-model="form.gradeChangeReason" placeholder="等级变化必须说明原因" />
          </el-form-item>
        </el-col>
        <el-col :span="24">
          <el-form-item label="备注"
            ><el-input v-model="form.notes" type="textarea" :rows="3"
          /></el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  CUSTOMER_GRADE_OPTIONS,
  listDimensionOptions,
  updateCustomer,
  type CustomerDetail,
  type CustomerDimension,
  type CustomerGrade,
  type DimensionOption,
} from '@crm/domain'

const props = defineProps<{ customer: CustomerDetail }>()
const emit = defineEmits<{ saved: [] }>()
const visible = ref(false)
const saving = ref(false)
const options = reactive<Record<CustomerDimension, DimensionOption[]>>({
  industry: [],
  sub_industry: [],
  customer_type: [],
  source: [],
  product_line: [],
  visit_type: [],
  opportunity_source: [],
  complaint_type: [],
  trade_type: [],
})
const form = reactive({
  name: '',
  customerCode: '',
  unifiedSocialCreditCode: '',
  province: '',
  city: '',
  industry: '',
  subIndustry: '',
  customerType: '',
  source: '',
  productLines: [] as string[],
  address: '',
  website: '',
  grade: 'C' as CustomerGrade,
  gradeChangeReason: '',
  notes: '',
})

onMounted(async () => {
  const dimensions: CustomerDimension[] = ['industry', 'customer_type', 'source', 'product_line']
  await Promise.all(
    dimensions.map(async (dimension) => {
      options[dimension] = (await listDimensionOptions(dimension).catch(() => [])).filter(
        (option) => option.isActive,
      )
    }),
  )
})

function open() {
  Object.assign(form, {
    name: props.customer.name,
    customerCode: props.customer.customerCode ?? '',
    unifiedSocialCreditCode: props.customer.unifiedSocialCreditCode ?? '',
    province: props.customer.province ?? '',
    city: props.customer.city ?? '',
    industry: props.customer.industry ?? '',
    subIndustry: props.customer.subIndustry ?? '',
    customerType: props.customer.customerType ?? '',
    source: props.customer.source ?? '',
    productLines: [...props.customer.productLines],
    address: props.customer.address ?? '',
    website: props.customer.website ?? '',
    grade: props.customer.grade,
    gradeChangeReason: '',
    notes: props.customer.notes ?? '',
  })
  visible.value = true
}

async function handleSave() {
  if (!form.name.trim()) return ElMessage.warning('客户名称必填')
  if (form.grade !== props.customer.grade && !form.gradeChangeReason.trim()) {
    return ElMessage.warning('调整客户等级必须填写原因')
  }
  saving.value = true
  try {
    await updateCustomer(props.customer.id, {
      version: props.customer.version,
      name: form.name.trim(),
      customerCode: form.customerCode.trim() || null,
      unifiedSocialCreditCode: form.unifiedSocialCreditCode.trim() || null,
      province: form.province.trim() || null,
      city: form.city.trim() || null,
      industry: form.industry || null,
      subIndustry: form.subIndustry.trim() || null,
      customerType: form.customerType || null,
      source: form.source || null,
      productLines: form.productLines,
      address: form.address.trim() || null,
      website: form.website.trim() || null,
      grade: form.grade,
      gradeChangeReason: form.gradeChangeReason.trim() || undefined,
      notes: form.notes.trim() || null,
    })
    ElMessage.success('客户资料已更新')
    visible.value = false
    emit('saved')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

defineExpose({ open })
</script>
