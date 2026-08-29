<template>
  <el-dialog v-model="visible" title="新建商机" width="720px" destroy-on-close>
    <el-form label-position="top" class="opportunity-form">
      <el-form-item label="客户" required class="opportunity-form__wide">
        <el-input
          v-if="contextCustomerId"
          :model-value="contextCustomerName || '当前客户'"
          disabled
        />
        <el-select
          v-else
          v-model="form.customerId"
          filterable
          remote
          reserve-keyword
          :remote-method="searchCustomers"
          :loading="customerLoading"
          placeholder="输入客户名称检索"
          style="width: 100%"
        >
          <el-option
            v-for="customer in customerOptions"
            :key="customer.id"
            :label="customer.name"
            :value="customer.id"
          >
            <span>{{ customer.name }}</span>
            <span class="opportunity-form__customer-meta">
              {{ [customer.city, customer.grade].filter(Boolean).join(' · ') }}
            </span>
          </el-option>
        </el-select>
      </el-form-item>

      <el-form-item label="商机名称" required class="opportunity-form__wide">
        <el-input v-model="form.name" placeholder="例如：二期过滤系统选型" maxlength="120" />
      </el-form-item>

      <el-form-item label="发现渠道" required>
        <el-select v-model="form.source" placeholder="请选择" style="width: 100%">
          <el-option
            v-for="option in sourceOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="产品线">
        <el-select
          v-model="form.productLines"
          multiple
          collapse-tags
          clearable
          placeholder="可多选"
          style="width: 100%"
        >
          <el-option
            v-for="option in productLineOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="初始金额依据" required>
        <el-select v-model="form.initialAmountBasis" style="width: 100%">
          <el-option label="预估金额" value="estimate" />
          <el-option label="口头报价" value="oral_quote" />
          <el-option label="正式报价单" value="formal_quote" />
        </el-select>
      </el-form-item>
      <el-form-item label="初始金额" required>
        <el-input-number
          v-model="form.initialAmount"
          :min="0"
          :precision="2"
          :controls="false"
          placeholder="金额"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item v-if="form.initialAmountBasis === 'estimate'" label="金额口径">
        <el-checkbox v-model="form.approximate">当前为约估金额</el-checkbox>
      </el-form-item>

      <el-form-item v-else label="报价时间" required>
        <el-date-picker
          v-model="form.initialQuotedAt"
          type="date"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>

      <template v-if="form.initialAmountBasis === 'formal_quote'">
        <el-form-item label="报价单号">
          <el-input v-model="form.initialQuoteNo" placeholder="可选" />
        </el-form-item>
        <el-form-item label="报价文件引用">
          <el-input v-model="form.initialQuoteDocumentRef" placeholder="可选链接或文件编号" />
        </el-form-item>
      </template>

      <el-form-item label="金额说明" class="opportunity-form__wide">
        <el-input
          v-model="form.estimateNote"
          placeholder="例如：按初步配置估算，待确认材质和流量"
          maxlength="200"
        />
      </el-form-item>

      <el-form-item label="需求发现日">
        <el-date-picker
          v-model="form.discoveredDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择日期"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="预计成交日">
        <el-date-picker
          v-model="form.expectedCloseDate"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="可选"
          style="width: 100%"
        />
      </el-form-item>

      <el-form-item label="第一步计划" required class="opportunity-form__wide">
        <el-input
          v-model="form.firstActionContent"
          placeholder="明确下一步要做什么，例如：确认工况和选型参数"
          maxlength="200"
        />
      </el-form-item>
      <el-form-item label="计划时间" required class="opportunity-form__wide">
        <el-date-picker
          v-model="form.firstActionAt"
          type="date"
          value-format="YYYY-MM-DD"
          placeholder="选择计划日期"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="submit">创建商机</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createOpportunity,
  listCustomers,
  listDimensionOptions,
  type CustomerItem,
  type DimensionOption,
} from '@crm/domain'

const props = defineProps<{ customerId?: string; customerName?: string }>()
const emit = defineEmits<{ created: [opportunityId: string] }>()

type SelectOption = { value: string; label: string }

const visible = ref(false)
const saving = ref(false)
const contextCustomerId = ref('')
const contextCustomerName = ref('')
const customerLoading = ref(false)
const customerOptions = ref<CustomerItem[]>([])
const sourceOptions = ref<SelectOption[]>([])
const productLineOptions = ref<SelectOption[]>([])
const form = reactive({
  customerId: '',
  name: '',
  source: '',
  productLines: [] as string[],
  initialAmountBasis: 'estimate' as 'estimate' | 'oral_quote' | 'formal_quote',
  initialAmount: undefined as number | undefined,
  initialQuotedAt: '',
  initialQuoteNo: '',
  initialQuoteDocumentRef: '',
  approximate: true,
  estimateNote: '',
  discoveredDate: '',
  expectedCloseDate: '',
  firstActionContent: '',
  firstActionAt: '',
})

function activeOptions(options: DimensionOption[]): SelectOption[] {
  return options
    .filter((option) => option.isActive)
    .map((option) => ({ value: option.name, label: option.label }))
}

onMounted(async () => {
  try {
    const [sources, productLines] = await Promise.all([
      listDimensionOptions('opportunity_source'),
      listDimensionOptions('product_line'),
    ])
    sourceOptions.value = activeOptions(sources)
    productLineOptions.value = activeOptions(productLines)
  } catch {
    ElMessage.error('商机分类加载失败，请稍后重试')
  }
})

async function searchCustomers(keyword = '') {
  if (contextCustomerId.value) return
  customerLoading.value = true
  try {
    const page = await listCustomers({ keyword: keyword.trim(), page: 1, pageSize: 20 })
    customerOptions.value = page.items
  } catch {
    ElMessage.error('客户检索失败')
  } finally {
    customerLoading.value = false
  }
}

function open(options?: { customerId?: string; customerName?: string; discoveredDate?: string }) {
  contextCustomerId.value = options?.customerId ?? props.customerId ?? ''
  contextCustomerName.value = options?.customerName ?? props.customerName ?? ''
  Object.assign(form, {
    customerId: contextCustomerId.value,
    name: '',
    source: '',
    productLines: [],
    initialAmountBasis: 'estimate',
    initialAmount: undefined,
    initialQuotedAt: localDate(new Date()),
    initialQuoteNo: '',
    initialQuoteDocumentRef: '',
    approximate: true,
    estimateNote: '',
    discoveredDate: options?.discoveredDate ?? today(),
    expectedCloseDate: '',
    firstActionContent: '',
    firstActionAt: localDate(tomorrow()),
  })
  visible.value = true
  if (!contextCustomerId.value) void searchCustomers()
}

async function submit() {
  const customerId = contextCustomerId.value || form.customerId
  if (
    !customerId ||
    !form.name.trim() ||
    !form.source ||
    form.initialAmount == null ||
    (form.initialAmountBasis !== 'estimate' && !form.initialQuotedAt) ||
    !form.firstActionContent.trim() ||
    !form.firstActionAt
  ) {
    ElMessage.warning('请填写客户、商机名称、渠道、初始金额依据和第一步计划')
    return
  }
  if (
    form.expectedCloseDate &&
    form.discoveredDate &&
    form.expectedCloseDate < form.discoveredDate
  ) {
    ElMessage.warning('预计成交日不能早于需求发现日')
    return
  }

  saving.value = true
  try {
    const result = await createOpportunity({
      customerId,
      name: form.name.trim(),
      source: form.source,
      productLines: form.productLines,
      initialAmountBasis: form.initialAmountBasis,
      initialAmount: form.initialAmount,
      approximate: form.initialAmountBasis === 'estimate' ? form.approximate : undefined,
      estimateNote: form.estimateNote.trim() || undefined,
      initialQuotedAt: form.initialAmountBasis === 'estimate' ? undefined : form.initialQuotedAt,
      initialQuoteNo:
        form.initialAmountBasis === 'formal_quote'
          ? form.initialQuoteNo.trim() || undefined
          : undefined,
      initialQuoteDocumentRef:
        form.initialAmountBasis === 'formal_quote'
          ? form.initialQuoteDocumentRef.trim() || undefined
          : undefined,
      discoveredDate: form.discoveredDate || undefined,
      expectedCloseDate: form.expectedCloseDate || undefined,
      firstActionContent: form.firstActionContent.trim(),
      firstActionAt: form.firstActionAt,
    })
    visible.value = false
    ElMessage.success('商机已创建')
    emit('created', result.id)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建商机失败')
  } finally {
    saving.value = false
  }
}

function today(): string {
  return localDate(new Date())
}

function tomorrow(): Date {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date
}

function localDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

defineExpose({ open })
</script>

<style scoped>
.opportunity-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--crm-spacing-lg);
}
.opportunity-form__wide {
  grid-column: 1 / -1;
}
.opportunity-form__customer-meta {
  float: right;
  margin-left: var(--crm-spacing-md);
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-sm);
}
@media (max-width: 720px) {
  .opportunity-form {
    grid-template-columns: 1fr;
  }
  .opportunity-form__wide {
    grid-column: auto;
  }
}
</style>
