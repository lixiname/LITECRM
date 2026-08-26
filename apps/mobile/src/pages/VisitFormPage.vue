<template>
  <div class="visit-form">
    <van-nav-bar title="记一笔拜访" left-arrow @click-left="router.back()" />

    <van-form @submit="handleSubmit">
      <van-cell-group inset>
        <van-field
          v-model="form.occurredAt"
          label="时间"
          type="datetime-local"
          :rules="[{ required: true, message: '请选择沟通时间' }]"
        />
        <van-field
          v-model="methodLabel"
          label="方式"
          placeholder="线下/远程/其他"
          readonly
          is-link
          :rules="[{ required: true, message: '请选择拜访方式' }]"
          @click="showMethod = true"
        />
        <van-field
          v-model="visitTypeLabel"
          label="类型"
          placeholder="选填"
          readonly
          is-link
          @click="showType = true"
        />
        <van-field
          v-model="form.businessSituation"
          label="生意情况"
          type="textarea"
          rows="2"
          autosize
          placeholder="生意情况"
        />
        <van-field
          v-model="form.equipmentSituation"
          label="设备使用"
          type="textarea"
          rows="2"
          autosize
          placeholder="设备使用"
        />
        <van-field v-model="form.personnelChanges" label="人员变动" placeholder="人员变动" />
        <van-field
          v-model="form.nextActionAt"
          label="下一行动时间"
          type="datetime-local"
          placeholder="选填"
        />
        <van-field
          v-model="form.nextActionContent"
          label="下一行动"
          placeholder="如：联系技术负责人确认参数"
        />
      </van-cell-group>

      <div class="visit-form__submit">
        <van-button round block type="primary" native-type="submit" :loading="saving"
          >提交</van-button
        >
      </div>
    </van-form>

    <van-popup v-model:show="showMethod" position="bottom" round>
      <van-picker
        :columns="VISIT_METHOD_OPTIONS"
        @confirm="onPickMethod"
        @cancel="showMethod = false"
      />
    </van-popup>
    <van-popup v-model:show="showType" position="bottom" round>
      <van-picker :columns="VISIT_TYPE_OPTIONS" @confirm="onPickType" @cancel="showType = false" />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { createVisit, VISIT_METHOD_OPTIONS, VISIT_TYPE_OPTIONS } from '@crm/domain'

const route = useRoute()
const router = useRouter()
const customerId = route.params.id as string

const form = reactive({
  occurredAt: '',
  method: '' as string,
  visitType: undefined as string | undefined,
  businessSituation: '',
  equipmentSituation: '',
  personnelChanges: '',
  nextActionAt: '',
  nextActionContent: '',
})
// 周览/记一笔预填日期（发生时间保留当前时分，下一行动默认当天 09:00）
const qDate = route.query.date as string | undefined
if (qDate) {
  const now = new Date()
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  form.occurredAt = `${qDate}T${hm}`
  form.nextActionAt = `${qDate}T09:00`
}
const methodLabel = ref('')
const visitTypeLabel = ref('')
const showMethod = ref(false)
const showType = ref(false)
const saving = ref(false)

function onPickMethod({ selectedOptions }: { selectedOptions: { text: string; value: string }[] }) {
  form.method = selectedOptions[0].value
  methodLabel.value = selectedOptions[0].text
  showMethod.value = false
}
function onPickType({ selectedOptions }: { selectedOptions: { text: string; value: string }[] }) {
  form.visitType = selectedOptions[0].value
  visitTypeLabel.value = selectedOptions[0].text
  showType.value = false
}

async function handleSubmit() {
  if (!!form.nextActionAt !== !!form.nextActionContent.trim()) {
    showToast('下一行动时间和内容需同时填写')
    return
  }
  saving.value = true
  try {
    await createVisit({
      customerId,
      occurredAt: new Date(form.occurredAt).toISOString(),
      method: form.method as never,
      visitType: form.visitType as never,
      businessSituation: form.businessSituation || undefined,
      equipmentSituation: form.equipmentSituation || undefined,
      personnelChanges: form.personnelChanges || undefined,
      nextActionAt: form.nextActionAt ? new Date(form.nextActionAt).toISOString() : undefined,
      nextActionContent: form.nextActionContent || undefined,
    })
    showToast('拜访已记录')
    router.back()
  } catch (e) {
    showToast(e instanceof Error ? e.message : '提交失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.visit-form__submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
