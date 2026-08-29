<template>
  <div class="visit-form">
    <van-nav-bar title="记一笔拜访" left-arrow @click-left="router.back()" />

    <van-form @submit="handleSubmit">
      <van-notice-bar
        v-if="sourcePlan"
        wrapable
        :scrollable="false"
        :text="`本次执行计划：${formatTime(sourcePlan.plannedAt)} · ${sourcePlan.content}`"
      />
      <van-cell-group inset>
        <van-field
          v-model="form.occurredAt"
          label="拜访日期"
          type="date"
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
          label="下次拜访日期"
          type="date"
          :rules="[{ required: true, message: '请选择下次拜访时间' }]"
        />
        <van-field
          v-model="form.nextActionContent"
          label="下次拜访内容"
          placeholder="如：联系技术负责人确认参数"
          :rules="[{ required: true, message: '请填写下次拜访内容' }]"
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
        :columns="visitMethodColumns"
        @confirm="onPickMethod"
        @cancel="showMethod = false"
      />
    </van-popup>
    <van-popup v-model:show="showType" position="bottom" round>
      <van-picker :columns="visitTypeColumns" @confirm="onPickType" @cancel="showType = false" />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  createVisit,
  getCustomer,
  getSalesPlan,
  listDimensionOptions,
  VISIT_METHOD_OPTIONS,
  type SalesPlan,
} from '@crm/domain'

const route = useRoute()
const router = useRouter()
const customerId = route.params.id as string
const sourcePlan = ref<SalesPlan>()

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
// 周览执行计划时，发生日期默认今天；下一次拜访默认明天。
const qDate = route.query.date as string | undefined
const now = new Date()
form.occurredAt = localDate(now)
const nextVisit = new Date(now)
nextVisit.setDate(nextVisit.getDate() + 1)
form.nextActionAt = localDate(nextVisit)
if (qDate) form.occurredAt = qDate
const methodLabel = ref('')
const visitTypeLabel = ref('')
const showMethod = ref(false)
const showType = ref(false)
const saving = ref(false)
const visitMethodColumns = VISIT_METHOD_OPTIONS.map((option) => ({
  value: option.value,
  text: option.label,
}))
const visitTypeColumns = ref<{ value: string; text: string }[]>([])

onMounted(async () => {
  try {
    const [options, plan, customer] = await Promise.all([
      listDimensionOptions('visit_type'),
      route.query.planId ? getSalesPlan(String(route.query.planId)) : Promise.resolve(undefined),
      getCustomer(customerId),
    ])
    if (plan && (plan.planKind !== 'customer_visit' || plan.customerId !== customerId)) {
      throw new Error('该计划不属于当前客户拜访')
    }
    sourcePlan.value = plan
    const currentPlan = plan ? undefined : customer.currentVisitPlan
    if (currentPlan) {
      form.nextActionAt = currentPlan.plannedAt
      form.nextActionContent = currentPlan.content
    }
    visitTypeColumns.value = options
      .filter((option) => option.isActive)
      .map((option) => ({ value: option.name, text: option.label }))
  } catch {
    showToast('拜访类型加载失败')
  }
})

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
  if (!form.nextActionAt || !form.nextActionContent.trim()) {
    showToast('请填写下次拜访时间和内容')
    return
  }
  saving.value = true
  try {
    await createVisit({
      customerId,
      occurredAt: form.occurredAt,
      method: form.method as never,
      visitType: form.visitType as never,
      businessSituation: form.businessSituation || undefined,
      equipmentSituation: form.equipmentSituation || undefined,
      personnelChanges: form.personnelChanges || undefined,
      sourcePlanId: sourcePlan.value?.id,
      nextActionAt: form.nextActionAt,
      nextActionContent: form.nextActionContent.trim(),
    })
    showToast('拜访已记录')
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

function formatTime(value: string): string {
  return value
}
</script>

<style scoped>
.visit-form__submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
