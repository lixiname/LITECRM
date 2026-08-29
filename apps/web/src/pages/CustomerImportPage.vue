<template>
  <div class="customer-import">
    <AppPageHeader
      title="批量导入客户"
      description="用于系统启用时迁入客户档案；不会生成虚假的商机、报价或成交记录"
    >
      <template #actions>
        <el-button @click="router.push('/customers')">返回客户列表</el-button>
        <el-button :loading="downloading" @click="downloadTemplate">下载模板</el-button>
      </template>
    </AppPageHeader>

    <el-card class="customer-import__card">
      <el-steps :active="activeStep" finish-status="success" class="customer-import__steps">
        <el-step title="选择文件" />
        <el-step title="核对口径" />
        <el-step title="预览并导入" />
      </el-steps>

      <section v-if="activeStep === 0" class="customer-import__section">
        <h3>上传 Excel 客户档案</h3>
        <p class="customer-import__help">
          支持 .xlsx，单次最多 2,000 行。建议下载模板后从第 3 行填写；客户名称必须提供，ERP
          编码、信用代码和联系人均可暂缺。
        </p>
        <el-upload
          drag
          :auto-upload="false"
          :limit="1"
          accept=".xlsx"
          :on-change="onFileChange"
          :on-remove="onFileRemove"
        >
          <div class="customer-import__upload-title">拖入文件，或点击选择</div>
          <template #tip>
            <div class="el-upload__tip">原始文件只用于读取，本系统不长期保存文件本身。</div>
          </template>
        </el-upload>
        <div class="customer-import__footer">
          <el-button type="primary" :disabled="!selectedFile" :loading="uploading" @click="upload">
            上传并读取
          </el-button>
        </div>
      </section>

      <section v-else-if="activeStep === 1 && batch" class="customer-import__section">
        <div class="customer-import__section-head">
          <div>
            <h3>核对导入口径与字段映射</h3>
            <p class="customer-import__help">{{ batch.fileName }} · {{ batch.totalRows }} 行数据</p>
          </div>
          <el-button link @click="reset">重新选择文件</el-button>
        </div>

        <el-form label-width="150px" class="customer-import__defaults">
          <el-form-item label="客户历史属性" required>
            <el-radio-group v-model="form.defaultRelationship">
              <el-radio-button value="pre_crm_existing">全部为存量客户</el-radio-button>
              <el-radio-button value="prospect">全部为潜在客户</el-radio-button>
              <el-radio-button value="per_row">按 Excel 逐行指定</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="导入去向" required>
            <el-radio-group v-model="form.targetStatus">
              <el-radio-button value="public">公海池</el-radio-button>
              <el-radio-button value="active">在案客户</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="form.targetStatus === 'active'" label="默认负责人">
            <el-select
              v-model="form.defaultOwnerId"
              clearable
              filterable
              placeholder="可由 Excel 负责人列覆盖"
            >
              <el-option
                v-for="owner in assignees"
                :key="owner.id"
                :label="owner.displayName"
                :value="owner.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-if="form.defaultRelationship !== 'prospect'" label="历史金额截止日">
            <el-date-picker
              v-model="form.dataCutoffOn"
              type="date"
              value-format="YYYY-MM-DD"
              placeholder="可选，仅说明金额口径"
            />
          </el-form-item>
        </el-form>

        <el-table :data="CUSTOMER_IMPORT_FIELD_OPTIONS" border class="customer-import__mapping">
          <el-table-column label="CRM 字段" width="210">
            <template #default="{ row }">
              {{ row.label }}
              <el-tag v-if="row.required" size="small" type="danger" effect="plain">必填</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Excel 列">
            <template #default="{ row }">
              <el-select
                v-model="form.mapping[row.value as CustomerImportField]"
                clearable
                filterable
                placeholder="不导入该字段"
                style="width: 100%"
              >
                <el-option
                  v-for="header in batch.headers"
                  :key="header"
                  :label="header"
                  :value="header"
                />
              </el-select>
            </template>
          </el-table-column>
        </el-table>

        <div class="customer-import__footer">
          <el-button type="primary" :loading="previewing" @click="preview">生成导入预览</el-button>
        </div>
      </section>

      <section v-else-if="activeStep >= 2 && previewResult" class="customer-import__section">
        <div class="customer-import__summary">
          <div>
            <strong>{{ previewResult.readyRows }}</strong
            ><span>可导入</span>
          </div>
          <div>
            <strong>{{ previewResult.duplicateRows }}</strong
            ><span>重复跳过</span>
          </div>
          <div>
            <strong>{{ previewResult.failedRows }}</strong
            ><span>数据错误</span>
          </div>
        </div>
        <el-alert
          v-if="commitResult"
          type="success"
          :closable="false"
          :title="`已导入 ${commitResult.importedRows} 家客户，跳过 ${commitResult.skippedRows} 行，失败 ${commitResult.failedRows} 行`"
          show-icon
        />
        <el-table
          :data="previewResult.rows"
          border
          max-height="520"
          class="customer-import__result"
        >
          <el-table-column prop="rowNumber" label="Excel 行" width="90" />
          <el-table-column label="客户名称" min-width="220">
            <template #default="{ row }">{{ row.data?.name ?? '—' }}</template>
          </el-table-column>
          <el-table-column label="结果" width="110">
            <template #default="{ row }">
              <el-tag :type="rowStatusType(row.status)">{{ rowStatusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="说明" min-width="260">
            <template #default="{ row }">{{ row.error ?? '校验通过' }}</template>
          </el-table-column>
        </el-table>
        <div class="customer-import__footer">
          <el-button v-if="!commitResult" @click="activeStep = 1">返回调整</el-button>
          <el-button
            v-if="!commitResult"
            type="primary"
            :disabled="previewResult.readyRows === 0"
            :loading="committing"
            @click="commit"
          >
            确认导入 {{ previewResult.readyRows }} 家客户
          </el-button>
          <el-button v-else type="primary" @click="router.push('/customers')"
            >查看客户列表</el-button
          >
        </div>
      </section>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, type UploadFile } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import {
  CUSTOMER_IMPORT_FIELD_OPTIONS,
  commitCustomerImport,
  downloadCustomerImportTemplate,
  listCustomerAssignees,
  previewCustomerImport,
  uploadCustomerImport,
  type AssigneeOption,
  type CustomerImportCommitResult,
  type CustomerImportField,
  type CustomerImportMapping,
  type CustomerImportPreviewResult,
  type CustomerImportUploadResult,
} from '@crm/domain'

const router = useRouter()
const activeStep = ref(0)
const selectedFile = ref<File | null>(null)
const batch = ref<CustomerImportUploadResult | null>(null)
const previewResult = ref<CustomerImportPreviewResult | null>(null)
const commitResult = ref<CustomerImportCommitResult | null>(null)
const assignees = ref<AssigneeOption[]>([])
const downloading = ref(false)
const uploading = ref(false)
const previewing = ref(false)
const committing = ref(false)

const form = reactive({
  mapping: {} as CustomerImportMapping,
  defaultRelationship: 'per_row' as 'pre_crm_existing' | 'prospect' | 'per_row',
  targetStatus: 'public' as 'active' | 'public',
  defaultOwnerId: '',
  dataCutoffOn: '',
})

onMounted(async () => {
  try {
    assignees.value = await listCustomerAssignees()
  } catch {
    assignees.value = []
  }
})

function onFileChange(file: UploadFile) {
  selectedFile.value = file.raw ?? null
}

function onFileRemove() {
  selectedFile.value = null
}

async function downloadTemplate() {
  downloading.value = true
  try {
    const blob = await downloadCustomerImportTemplate()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = '客户导入模板.xlsx'
    link.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    ElMessage.error(messageOf(error))
  } finally {
    downloading.value = false
  }
}

async function upload() {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    batch.value = await uploadCustomerImport(selectedFile.value)
    form.mapping = { ...batch.value.suggestedMapping }
    activeStep.value = 1
  } catch (error) {
    ElMessage.error(messageOf(error))
  } finally {
    uploading.value = false
  }
}

async function preview() {
  if (!batch.value) return
  if (!form.mapping.name) return ElMessage.warning('请映射客户名称列')
  if (form.targetStatus === 'active' && !form.defaultOwnerId && !form.mapping.ownerUsername) {
    return ElMessage.warning('导入在案客户时，请选择默认负责人或映射负责人列')
  }
  previewing.value = true
  try {
    previewResult.value = await previewCustomerImport(batch.value.id, {
      mapping: form.mapping,
      defaultRelationship: form.defaultRelationship,
      targetStatus: form.targetStatus,
      defaultOwnerId: form.defaultOwnerId || undefined,
      dataCutoffOn: form.dataCutoffOn || undefined,
    })
    activeStep.value = 2
  } catch (error) {
    ElMessage.error(messageOf(error))
  } finally {
    previewing.value = false
  }
}

async function commit() {
  if (!batch.value) return
  committing.value = true
  try {
    commitResult.value = await commitCustomerImport(batch.value.id)
    ElMessage.success('客户导入完成')
  } catch (error) {
    ElMessage.error(messageOf(error))
  } finally {
    committing.value = false
  }
}

function reset() {
  activeStep.value = 0
  selectedFile.value = null
  batch.value = null
  previewResult.value = null
  commitResult.value = null
  form.mapping = {}
}

function rowStatusLabel(status: string) {
  return status === 'ready' ? '可导入' : status === 'duplicate' ? '重复跳过' : '数据错误'
}

function rowStatusType(status: string) {
  return status === 'ready' ? 'success' : status === 'duplicate' ? 'warning' : 'danger'
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : '操作失败，请重试'
}
</script>

<style scoped>
.customer-import {
  padding-bottom: var(--crm-spacing-xl);
}
.customer-import__card {
  margin: 0 var(--crm-spacing-lg);
}
.customer-import__steps {
  max-width: 780px;
  margin: 8px auto 36px;
}
.customer-import__section {
  max-width: 980px;
  margin: 0 auto;
}
.customer-import__section h3 {
  margin: 0 0 8px;
}
.customer-import__section-head,
.customer-import__footer,
.customer-import__summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.customer-import__help {
  margin: 0 0 20px;
  color: var(--crm-color-text-secondary);
}
.customer-import__upload-title {
  font-size: var(--crm-font-size-md);
  color: var(--crm-color-text-primary);
}
.customer-import__defaults {
  padding: 20px 0 4px;
  border-top: 1px solid var(--crm-color-border);
}
.customer-import__mapping,
.customer-import__result {
  margin-top: 12px;
}
.customer-import__footer {
  justify-content: flex-end;
  gap: 12px;
  margin-top: 24px;
}
.customer-import__summary {
  justify-content: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}
.customer-import__summary > div {
  display: flex;
  min-width: 150px;
  padding: 16px 20px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-sm);
  flex-direction: column;
}
.customer-import__summary strong {
  font-size: 24px;
}
.customer-import__summary span {
  color: var(--crm-color-text-secondary);
}
</style>
