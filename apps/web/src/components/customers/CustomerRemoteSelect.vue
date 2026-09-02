<template>
  <el-select
    :model-value="modelValue"
    filterable
    remote
    reserve-keyword
    clearable
    :remote-method="scheduleSearch"
    :loading="loading"
    :placeholder="placeholder"
    style="width: 100%"
    @update:model-value="selectCustomer"
    @visible-change="handleVisibleChange"
  >
    <el-option
      v-for="customer in options"
      :key="customer.id"
      :label="customer.name"
      :value="customer.id"
    >
      <span>{{ customer.name }}</span>
      <span class="customer-remote-select__meta">
        {{ customerMeta(customer) }}
      </span>
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { listCustomers, type CustomerItem } from '@crm/domain'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  { placeholder: '输入客户名称或城市检索' },
)
const emit = defineEmits<{
  'update:modelValue': [value: string]
  selected: [customer: CustomerItem | undefined]
}>()

const options = ref<CustomerItem[]>([])
const selected = ref<CustomerItem>()
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let searchRevision = 0

watch(
  () => props.modelValue,
  (value) => {
    if (!value) selected.value = undefined
  },
)

function handleVisibleChange(visible: boolean) {
  if (visible && !options.value.length) void search('')
}

function scheduleSearch(keyword: string) {
  clearTimeout(timer)
  const revision = ++searchRevision
  loading.value = true
  timer = setTimeout(() => void search(keyword, revision), 300)
}

async function search(keyword: string, revision = ++searchRevision) {
  loading.value = true
  try {
    const page = await listCustomers({
      status: 'active',
      keyword: keyword.trim(),
      page: 1,
      pageSize: 20,
    })
    if (revision !== searchRevision) return
    const next = [...page.items]
    if (selected.value && !next.some((item) => item.id === selected.value?.id)) {
      next.unshift(selected.value)
    }
    options.value = next
  } catch {
    if (revision === searchRevision) ElMessage.error('客户检索失败，请稍后重试')
  } finally {
    if (revision === searchRevision) loading.value = false
  }
}

function selectCustomer(value: string | undefined) {
  const nextValue = value ?? ''
  selected.value = options.value.find((item) => item.id === nextValue)
  emit('update:modelValue', nextValue)
  emit('selected', selected.value)
}

function customerMeta(customer: CustomerItem): string {
  return [customer.city, customer.grade ? `${customer.grade}级` : ''].filter(Boolean).join(' · ')
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  searchRevision += 1
})
</script>

<style scoped>
.customer-remote-select__meta {
  float: right;
  margin-left: var(--crm-spacing-md);
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
</style>
