<template>
  <div class="complaint-form">
    <van-nav-bar title="登记客诉" left-arrow @click-left="router.back()" />

    <van-form @submit="handleSubmit">
      <van-cell-group inset>
        <van-field
          v-model="form.occurredAt"
          label="发生时间"
          type="datetime-local"
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
          label="第一步行动时间"
          type="datetime-local"
          :rules="[{ required: true }]"
        />
        <van-field
          v-model="form.firstActionContent"
          label="第一步行动"
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
  occurredAt: '',
  type: '' as string,
  description: '',
  firstActionAt: '',
  firstActionContent: '',
})
// 周览/记一笔预填日期（发生时间保留当前时分，第一步行动默认当天 09:00）
const qDate = route.query.date as string | undefined
if (qDate) {
  const now = new Date()
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  form.occurredAt = `${qDate}T${hm}`
  form.firstActionAt = `${qDate}T09:00`
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
      occurredAt: new Date(form.occurredAt).toISOString(),
      type: form.type as never,
      description: form.description,
      firstActionAt: new Date(form.firstActionAt).toISOString(),
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
</script>

<style scoped>
.complaint-form__submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
