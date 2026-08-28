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
          v-model="amountBasisLabel"
          label="金额依据"
          readonly
          is-link
          :rules="[{ required: true }]"
          @click="showAmountBasis = true"
        />
        <van-field
          v-model.number="form.initialAmount"
          label="初始金额"
          type="number"
          placeholder="元"
          :rules="[{ required: true, message: '请填写初始金额' }]"
        />
        <van-switch-cell
          v-if="form.initialAmountBasis === 'estimate'"
          v-model="form.approximate"
          title="当前为约估金额"
        />
        <van-field
          v-if="form.initialAmountBasis !== 'estimate'"
          v-model="form.initialQuotedAt"
          label="报价时间"
          type="datetime-local"
          :rules="[{ required: true }]"
        />
        <van-field
          v-if="form.initialAmountBasis === 'formal_quote'"
          v-model="form.initialQuoteNo"
          label="报价单号"
          placeholder="可选"
        />
        <van-field
          v-if="form.initialAmountBasis === 'formal_quote'"
          v-model="form.initialQuoteDocumentRef"
          label="报价文件"
          placeholder="可选链接或文件编号"
        />
        <van-field
          v-model="form.estimateNote"
          label="金额说明"
          type="textarea"
          rows="2"
          placeholder="如：按初步配置估算，待确认材质和流量"
        />
        <van-field v-model="form.discoveredDate" label="需求发现日" type="date" />
        <van-field v-model="form.expectedCloseDate" label="预计成交日" type="date" />
        <van-field label="产品线">
          <template #input>
            <van-checkbox-group v-model="form.productLines" direction="horizontal">
              <van-checkbox
                v-for="option in productLineOptions"
                :key="option.value"
                :name="option.value"
                shape="square"
              >
                {{ option.text }}
              </van-checkbox>
            </van-checkbox-group>
          </template>
        </van-field>
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
    <van-popup v-model:show="showAmountBasis" position="bottom" round>
      <van-picker
        :columns="amountBasisColumns"
        @confirm="onPickAmountBasis"
        @cancel="showAmountBasis = false"
      />
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
  productLines: [] as string[],
  initialAmountBasis: 'estimate' as 'estimate' | 'oral_quote' | 'formal_quote',
  initialAmount: undefined as number | undefined,
  approximate: true,
  estimateNote: '',
  discoveredDate: localDate(new Date()),
  expectedCloseDate: '',
  initialQuotedAt: localInput(new Date()),
  initialQuoteNo: '',
  initialQuoteDocumentRef: '',
  firstActionContent: '',
  firstActionAt: '',
})
// 周览/记一笔预填日期（query.date → 第一步行动时间）
const qDate = route.query.date as string | undefined
if (qDate) form.firstActionAt = `${qDate}T09:00`
const sourceLabel = ref('')
const showSource = ref(false)
const showAmountBasis = ref(false)
const saving = ref(false)
const sourceColumns = ref<{ value: string; text: string }[]>([])
const productLineOptions = ref<{ value: string; text: string }[]>([])
const amountBasisLabel = ref('预估金额')
const amountBasisColumns = [
  { value: 'estimate', text: '预估金额' },
  { value: 'oral_quote', text: '口头报价' },
  { value: 'formal_quote', text: '正式报价单' },
]

onMounted(async () => {
  try {
    const [sources, productLines] = await Promise.all([
      listDimensionOptions('opportunity_source'),
      listDimensionOptions('product_line'),
    ])
    sourceColumns.value = sources
      .filter((option) => option.isActive)
      .map((option) => ({ value: option.name, text: option.label }))
    productLineOptions.value = productLines
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
function onPickAmountBasis({
  selectedOptions,
}: {
  selectedOptions: { text: string; value: 'estimate' | 'oral_quote' | 'formal_quote' }[]
}) {
  form.initialAmountBasis = selectedOptions[0].value
  amountBasisLabel.value = selectedOptions[0].text
  showAmountBasis.value = false
}
async function handleSubmit() {
  if (
    form.expectedCloseDate &&
    form.discoveredDate &&
    form.expectedCloseDate < form.discoveredDate
  ) {
    return showToast('预计成交日不能早于需求发现日')
  }
  saving.value = true
  try {
    await createOpportunity({
      customerId,
      name: form.name,
      source: form.source as never,
      productLines: form.productLines,
      initialAmountBasis: form.initialAmountBasis,
      initialAmount: form.initialAmount!,
      approximate: form.initialAmountBasis === 'estimate' ? form.approximate : undefined,
      estimateNote: form.estimateNote.trim() || undefined,
      discoveredDate: form.discoveredDate || undefined,
      expectedCloseDate: form.expectedCloseDate || undefined,
      initialQuotedAt:
        form.initialAmountBasis === 'estimate'
          ? undefined
          : new Date(form.initialQuotedAt).toISOString(),
      initialQuoteNo:
        form.initialAmountBasis === 'formal_quote' ? form.initialQuoteNo || undefined : undefined,
      initialQuoteDocumentRef:
        form.initialAmountBasis === 'formal_quote'
          ? form.initialQuoteDocumentRef.trim() || undefined
          : undefined,
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

function localInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function localDate(date: Date): string {
  return localInput(date).slice(0, 10)
}
</script>

<style scoped>
.opp-form__submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
