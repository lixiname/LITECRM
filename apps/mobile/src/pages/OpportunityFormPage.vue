<template>
  <div class="opp-form">
    <van-nav-bar title="新建商机" left-arrow @click-left="router.back()" />

    <van-form @submit="handleSubmit">
      <van-cell-group inset>
        <van-field
          v-model="form.name"
          label="需求"
          placeholder="需求简述"
          :rules="[{ required: true }]"
        />
        <van-field
          v-model="sourceLabel"
          label="发现渠道"
          readonly
          is-link
          :rules="[{ required: true, message: '请选择渠道' }]"
          @click="showSource = true"
        />
        <van-field
          v-model.number="form.estimatedAmount"
          label="意向规模"
          type="number"
          placeholder="元"
          :rules="[{ required: true, message: '请填意向规模估计' }]"
        />
        <van-field
          v-model="form.firstActionContent"
          label="第一步计划"
          placeholder="如：约见技术负责人"
          :rules="[{ required: true }]"
        />
        <van-field
          v-model="form.firstActionAt"
          label="计划时间"
          type="datetime-local"
          :rules="[{ required: true }]"
        />
      </van-cell-group>

      <div class="opp-form__submit">
        <van-button round block type="primary" native-type="submit" :loading="saving"
          >提交</van-button
        >
      </div>
    </van-form>

    <van-popup v-model:show="showSource" position="bottom" round>
      <van-picker :columns="sourceColumns" @confirm="onPickSource" @cancel="showSource = false" />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { createOpportunity, listDimensionOptions } from '@crm/domain'

const route = useRoute()
const router = useRouter()
const customerId = route.params.id as string

const form = reactive({
  name: '',
  source: '' as string,
  estimatedAmount: undefined as number | undefined,
  firstActionContent: '',
  firstActionAt: '',
})
// 周览/记一笔预填日期（query.date → 第一步行动时间）
const qDate = route.query.date as string | undefined
if (qDate) form.firstActionAt = `${qDate}T09:00`
const sourceLabel = ref('')
const showSource = ref(false)
const saving = ref(false)
const sourceColumns = ref<{ value: string; text: string }[]>([])

onMounted(async () => {
  try {
    const options = await listDimensionOptions('opportunity_source')
    sourceColumns.value = options
      .filter((option) => option.isActive)
      .map((option) => ({ value: option.name, text: option.label }))
  } catch {
    showToast('商机渠道加载失败')
  }
})

function onPickSource({ selectedOptions }: { selectedOptions: { text: string; value: string }[] }) {
  form.source = selectedOptions[0].value
  sourceLabel.value = selectedOptions[0].text
  showSource.value = false
}
async function handleSubmit() {
  saving.value = true
  try {
    await createOpportunity({
      customerId,
      name: form.name,
      source: form.source as never,
      estimatedAmount: form.estimatedAmount!,
      firstActionContent: form.firstActionContent,
      firstActionAt: new Date(form.firstActionAt).toISOString(),
    })
    showToast('商机已创建')
    router.back()
  } catch (e) {
    showToast(e instanceof Error ? e.message : '提交失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.opp-form__submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
