<template>
  <div class="complaint-form">
    <van-nav-bar title="登记客诉" left-arrow @click-left="router.back()" />

    <van-form @submit="handleSubmit">
      <van-cell-group inset>
        <van-field
          v-model="form.occurredAt"
          label="发生日期"
          type="date"
          :rules="[{ required: true }]"
        />
        <van-field
          v-model="typeLabel"
          label="类型"
          readonly
          is-link
          :rules="[{ required: true, message: '请选择客诉类型' }]"
          @click="showType = true"
        />
        <van-field
          v-model="form.description"
          label="描述"
          type="textarea"
          rows="3"
          autosize
          placeholder="问题描述"
          :rules="[{ required: true, message: '请填写描述' }]"
        />
        <van-field
          v-model="form.firstActionAt"
          label="第一步计划日期"
          type="date"
          :rules="[{ required: true }]"
        />
        <van-field
          v-model="form.firstActionContent"
          label="第一步计划"
          placeholder="如：联系客户确认工况"
          :rules="[{ required: true }]"
        />
      </van-cell-group>

      <div class="complaint-form__submit">
        <van-button round block type="primary" native-type="submit" :loading="saving"
          >提交</van-button
        >
      </div>
    </van-form>

    <van-popup v-model:show="showType" position="bottom" round>
      <van-picker :columns="typeColumns" @confirm="onPickType" @cancel="showType = false" />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { createComplaint, listDimensionOptions } from '@crm/domain'

const route = useRoute()
const router = useRouter()
const customerId = route.params.id as string

const form = reactive({
  occurredAt: localDate(new Date()),
  type: '' as string,
  description: '',
  firstActionAt: tomorrow(),
  firstActionContent: '',
})
// 周览/记一笔预填业务日期；不虚构具体时分。
const qDate = route.query.date as string | undefined
if (qDate) {
  form.occurredAt = qDate
  form.firstActionAt = qDate
}
const typeLabel = ref('')
const showType = ref(false)
const saving = ref(false)
const typeColumns = ref<{ value: string; text: string }[]>([])

onMounted(async () => {
  try {
    const options = await listDimensionOptions('complaint_type')
    typeColumns.value = options
      .filter((option) => option.isActive)
      .map((option) => ({ value: option.name, text: option.label }))
  } catch {
    showToast('客诉类型加载失败')
  }
})

function onPickType({ selectedOptions }: { selectedOptions: { text: string; value: string }[] }) {
  form.type = selectedOptions[0].value
  typeLabel.value = selectedOptions[0].text
  showType.value = false
}

async function handleSubmit() {
  saving.value = true
  try {
    await createComplaint({
      customerId,
      occurredAt: form.occurredAt,
      type: form.type as never,
      description: form.description,
      firstActionAt: form.firstActionAt,
      firstActionContent: form.firstActionContent,
    })
    showToast('客诉已登记')
    router.back()
  } catch (e) {
    showToast(e instanceof Error ? e.message : '提交失败')
  } finally {
    saving.value = false
  }
}

function localDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

function tomorrow(): string {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return localDate(date)
}
</script>

<style scoped>
.complaint-form__submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
