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
          v-model="amountTypeLabel"
          label="金额类型"
          readonly
          is-link
          :rules="[{ required: true }]"
          @click="showAmountType = true"
        />
        <van-field
          v-model.number="form.amount"
          label="意向金额"
          type="number"
          placeholder="元"
          :rules="[{ required: true, message: '请填意向金额' }]"
        />
        <van-field
          v-model="form.nextAction"
          label="下一步"
          placeholder="下一步动作"
          :rules="[{ required: true }]"
        />
        <van-field
          v-model="form.nextFollowUpDate"
          label="下次跟进"
          type="date"
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
      <van-picker
        :columns="OPPORTUNITY_SOURCE_OPTIONS"
        @confirm="onPickSource"
        @cancel="showSource = false"
      />
    </van-popup>
    <van-popup v-model:show="showAmountType" position="bottom" round>
      <van-picker
        :columns="AMOUNT_TYPE_OPTIONS"
        @confirm="onPickAmountType"
        @cancel="showAmountType = false"
      />
    </van-popup>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import { createOpportunity, OPPORTUNITY_SOURCE_OPTIONS } from '@crm/domain'

const route = useRoute()
const router = useRouter()
const customerId = route.params.id as string

const AMOUNT_TYPE_OPTIONS = [
  { text: '口头', value: 'oral' },
  { text: '报价', value: 'quoted' },
]

const form = reactive({
  name: '',
  source: '' as string,
  amountType: 'oral',
  amount: undefined as number | undefined,
  nextAction: '',
  nextFollowUpDate: '',
})
const sourceLabel = ref('')
const amountTypeLabel = ref('口头')
const showSource = ref(false)
const showAmountType = ref(false)
const saving = ref(false)

function onPickSource({ selectedOptions }: { selectedOptions: { text: string; value: string }[] }) {
  form.source = selectedOptions[0].value
  sourceLabel.value = selectedOptions[0].text
  showSource.value = false
}
function onPickAmountType({
  selectedOptions,
}: {
  selectedOptions: { text: string; value: string }[]
}) {
  form.amountType = selectedOptions[0].value
  amountTypeLabel.value = selectedOptions[0].text
  showAmountType.value = false
}

async function handleSubmit() {
  saving.value = true
  try {
    await createOpportunity({
      customerId,
      name: form.name,
      source: form.source as never,
      amountType: form.amountType as never,
      amount: form.amount!,
      nextAction: form.nextAction,
      nextFollowUpDate: form.nextFollowUpDate,
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
