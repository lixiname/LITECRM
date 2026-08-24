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
          v-model="form.nextFollowUpDate"
          label="下次确认"
          type="date"
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
      <van-picker
        :columns="COMPLAINT_TYPE_OPTIONS"
        @confirm="onPickType"
        @cancel="showType = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { createComplaint, COMPLAINT_TYPE_OPTIONS } from '@crm/domain'

const route = useRoute()
const router = useRouter()
const customerId = route.params.id as string

const form = reactive({
  occurredAt: '',
  type: '' as string,
  description: '',
  nextFollowUpDate: '',
})
// 周览/记一笔预填日期（query.date → occurredAt 保留当前时分 + 跟进日期）
const qDate = route.query.date as string | undefined
if (qDate) {
  const now = new Date()
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  form.occurredAt = `${qDate}T${hm}`
  form.nextFollowUpDate = qDate
}
const typeLabel = ref('')
const showType = ref(false)
const saving = ref(false)

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
      nextFollowUpDate: form.nextFollowUpDate,
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
