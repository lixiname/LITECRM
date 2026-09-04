<template>
  <div class="pipeline-panel">
    <el-card shadow="never">
      <template #header>
        <div class="pipeline-panel__title">
          <span>期间推进与结果</span>
          <small>新增按首次登记金额，结案不扣减；各项不可相加</small>
        </div>
      </template>
      <div class="pipeline-panel__flow">
        <div v-for="step in flowSteps" :key="step.label" class="pipeline-panel__step">
          <span>{{ step.label }}</span>
          <strong>{{ step.metric.count }}</strong>
          <small>{{ money(step.metric.amount) }}</small>
        </div>
      </div>
      <small v-if="data.flow.created.missingAmountCount" class="pipeline-panel__missing-amount">
        本期 {{ data.flow.created.missingAmountCount }} 个旧商机未保留初始金额，仅计入新增数量。
      </small>
      <div class="pipeline-panel__rate">
        结案赢单率：
        <strong>{{
          data.flow.closedWinRate === null ? '暂无可计算结案' : percent(data.flow.closedWinRate)
        }}</strong>
        <small>赢单 ÷（赢单 + 丢失/需求消失）</small>
      </div>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="pipeline-panel__title">
          <span>销售大区经营对比</span>
          <small>按人员所属大区归集；点击大区查看人员明细</small>
        </div>
      </template>
      <el-table
        :data="data.byRegion"
        :row-class-name="regionRowClass"
        border
        @row-click="selectRegion"
      >
        <el-table-column prop="salesRegionName" label="销售大区" min-width="120" fixed />
        <el-table-column prop="memberCount" label="人数" width="72" align="right" />
        <el-table-column prop="openCount" label="开放商机" width="95" align="right" />
        <el-table-column label="商机池总额" min-width="135" align="right">
          <template #default="{ row }">{{ money((row as PipelineOwnerRow).openAmount) }}</template>
        </el-table-column>
        <el-table-column label="当前金额依据构成" min-width="260">
          <template #default="{ row }">
            <div
              class="pipeline-panel__mini-bar"
              role="img"
              :aria-label="ownerCompositionLabel(row)"
            >
              <span
                v-for="bucket in ownerBuckets(row as PipelineRegionRow)"
                :key="bucket.key"
                :class="`is-${bucket.key}`"
                :style="{ width: `${ownerPercentage(row as PipelineRegionRow, bucket.amount)}%` }"
                :title="`${bucket.label}：${money(bucket.amount)}`"
              />
            </div>
            <small class="pipeline-panel__composition-copy">
              预估
              {{
                ownerPercentage(
                  row as PipelineRegionRow,
                  (row as PipelineRegionRow).estimateAmount,
                )
              }}% · 口头
              {{
                ownerPercentage(
                  row as PipelineRegionRow,
                  (row as PipelineRegionRow).oralQuoteAmount,
                )
              }}% · 正式
              {{
                ownerPercentage(
                  row as PipelineRegionRow,
                  (row as PipelineRegionRow).formalQuoteAmount,
                )
              }}%
            </small>
          </template>
        </el-table-column>
        <el-table-column label="停滞金额" min-width="130" align="right">
          <template #default="{ row }">
            <span
              :class="{ 'pipeline-panel__danger': (row as PipelineRegionRow).stagnantAmount > 0 }"
            >
              {{ money((row as PipelineRegionRow).stagnantAmount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="本期成交" min-width="130" align="right">
          <template #default="{ row }">{{ money((row as PipelineRegionRow).wonAmount) }}</template>
        </el-table-column>
      </el-table>

      <div v-if="selectedRegion" class="pipeline-panel__owners">
        <div class="pipeline-panel__title">
          <strong>{{ selectedRegion.salesRegionName }} · 人员明细</strong>
          <small>点击人员进入其商机清单</small>
        </div>
        <el-table
          :data="selectedOwners"
          border
          row-class-name="pipeline-panel__row"
          @row-click="openOwnerOpportunities"
        >
          <el-table-column prop="ownerName" label="负责人" min-width="110" fixed />
          <el-table-column prop="openCount" label="开放商机" width="95" align="right" />
          <el-table-column label="商机池总额" min-width="135" align="right">
            <template #default="{ row }">{{
              money((row as PipelineOwnerRow).openAmount)
            }}</template>
          </el-table-column>
          <el-table-column label="仅预估 / 口头 / 正式" min-width="190">
            <template #default="{ row }">
              {{
                ownerPercentage(row as PipelineOwnerRow, (row as PipelineOwnerRow).estimateAmount)
              }}% ·
              {{
                ownerPercentage(row as PipelineOwnerRow, (row as PipelineOwnerRow).oralQuoteAmount)
              }}% ·
              {{
                ownerPercentage(
                  row as PipelineOwnerRow,
                  (row as PipelineOwnerRow).formalQuoteAmount,
                )
              }}%
            </template>
          </el-table-column>
          <el-table-column label="停滞金额" min-width="130" align="right">
            <template #default="{ row }">
              <span
                :class="{ 'pipeline-panel__danger': (row as PipelineOwnerRow).stagnantAmount > 0 }"
              >
                {{ money((row as PipelineOwnerRow).stagnantAmount) }}
              </span>
            </template>
          </el-table-column>
          <el-table-column label="本期成交" min-width="130" align="right">
            <template #default="{ row }">{{ money((row as PipelineOwnerRow).wonAmount) }}</template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { PipelineOwnerRow, PipelineRegionRow, PipelineReport } from '@crm/domain'

const props = defineProps<{ data: PipelineReport }>()
const router = useRouter()
const selectedRegionKey = ref('')
const selectedRegion = computed(() =>
  props.data.byRegion.find((row) => regionKey(row.salesRegionId) === selectedRegionKey.value),
)
const selectedOwners = computed(() =>
  props.data.byOwner.filter((row) => regionKey(row.salesRegionId) === selectedRegionKey.value),
)
watch(
  () => props.data.byRegion,
  (rows) => {
    if (!rows.some((row) => regionKey(row.salesRegionId) === selectedRegionKey.value)) {
      selectedRegionKey.value = rows[0] ? regionKey(rows[0].salesRegionId) : ''
    }
  },
  { immediate: true },
)
const flowSteps = computed(() => [
  { label: '新增商机', metric: props.data.flow.created },
  { label: '首次报价', metric: props.data.flow.firstQuoted },
  { label: '首次正式报价', metric: props.data.flow.firstFormalQuoted },
  { label: '确认成交', metric: props.data.flow.won },
  { label: '失败结案', metric: props.data.flow.lost },
])
function money(value: number): string {
  return `¥${value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}
function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}
function ownerBuckets(row: PipelineOwnerRow | PipelineRegionRow) {
  return [
    { key: 'estimate', label: '仅预估', amount: row.estimateAmount },
    { key: 'oral_quote', label: '口头报价', amount: row.oralQuoteAmount },
    { key: 'formal_quote', label: '正式报价', amount: row.formalQuoteAmount },
  ] as const
}
function ownerPercentage(row: PipelineOwnerRow | PipelineRegionRow, amount: number): number {
  if (!row.openAmount) return 0
  return Math.round((amount / row.openAmount) * 100)
}
function ownerCompositionLabel(row: PipelineOwnerRow | PipelineRegionRow): string {
  return ownerBuckets(row)
    .map((bucket) => `${bucket.label}${ownerPercentage(row, bucket.amount)}%`)
    .join('，')
}
function regionKey(id: string | null): string {
  return id ?? '__unassigned__'
}
function selectRegion(row: PipelineRegionRow) {
  selectedRegionKey.value = regionKey(row.salesRegionId)
}
function regionRowClass({ row }: { row: PipelineRegionRow }): string {
  return regionKey(row.salesRegionId) === selectedRegionKey.value
    ? 'pipeline-panel__row is-selected'
    : 'pipeline-panel__row'
}
function openOwnerOpportunities(row: PipelineOwnerRow) {
  void router.push({ path: '/opportunities', query: { ownerId: row.ownerId } })
}
</script>

<style scoped>
.pipeline-panel {
  display: grid;
  gap: var(--crm-spacing-md);
}
.pipeline-panel__title,
.pipeline-panel__rate {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-md);
}
.pipeline-panel__title small,
.pipeline-panel__rate small {
  color: var(--crm-color-text-secondary);
}
.pipeline-panel__flow {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--crm-spacing-sm);
  margin-bottom: var(--crm-spacing-lg);
}
.pipeline-panel__missing-amount {
  display: block;
  margin-bottom: var(--crm-spacing-sm);
  color: var(--crm-color-text-secondary);
}
.pipeline-panel__step {
  display: grid;
  gap: 4px;
  padding: var(--crm-spacing-md);
  border-radius: var(--crm-radius-sm);
  background: var(--crm-color-bg-page);
  text-align: center;
}
.pipeline-panel__step strong {
  font-size: 24px;
}
.pipeline-panel__step small {
  color: var(--crm-color-text-secondary);
}
.pipeline-panel__danger {
  color: var(--el-color-danger);
  font-weight: 600;
}
.pipeline-panel__owners {
  display: grid;
  gap: var(--crm-spacing-sm);
  margin-top: var(--crm-spacing-lg);
  padding-top: var(--crm-spacing-lg);
  border-top: 1px solid var(--crm-color-divider);
}
.pipeline-panel__mini-bar {
  display: flex;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--crm-color-bg-page);
}
.pipeline-panel__mini-bar span + span {
  border-left: 1px solid #fff;
}
.pipeline-panel__composition-copy {
  display: block;
  margin-top: 6px;
  color: var(--crm-color-text-secondary);
  white-space: nowrap;
}
.is-estimate {
  background: #94a3b8;
}
.is-oral_quote {
  background: var(--crm-color-primary);
}
.is-formal_quote {
  background: var(--el-color-success);
}
:deep(.pipeline-panel__row) {
  cursor: pointer;
}
:deep(.pipeline-panel__row.is-selected > td.el-table__cell) {
  background: var(--el-color-primary-light-9);
}
</style>
