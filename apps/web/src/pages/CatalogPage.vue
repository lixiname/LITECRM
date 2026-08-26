<template>
  <div class="catalog">
    <AppPageHeader title="字典配置" description="按业务维度维护可选项及启用状态">
      <template #actions>
        <el-select v-model="dimension" style="width: 160px">
          <el-option v-for="d in DIMENSIONS" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
        <el-button type="primary" @click="openAdd">新增选项</el-button>
      </template>
    </AppPageHeader>

    <el-card v-loading="loading" class="catalog__card">
      <el-table v-if="!error && options?.length" :data="options" border>
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'">{{
              row.isActive ? '启用' : '停用'
            }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button
              size="small"
              :type="row.isActive ? 'danger' : 'success'"
              @click="toggle(row)"
              >{{ row.isActive ? '停用' : '启用' }}</el-button
            >
          </template>
        </el-table-column>
      </el-table>
      <AppQueryState
        :error="error"
        :empty="!loading && !options?.length"
        empty-text="该维度暂无选项"
        @retry="reload"
      />
    </el-card>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑选项' : '新增选项'"
      width="400px"
    >
      <el-form label-width="70px">
        <el-form-item label="名称" required>
          <el-input v-model="dialog.name" placeholder="选项名称" />
        </el-form-item>
        <el-form-item label="排序">
          <el-input-number v-model="dialog.sortOrder" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="handleSave">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import {
  useQuery,
  listDimensionOptions,
  createOption,
  updateOption,
  type DimensionOption,
  type CustomerDimension,
} from '@crm/domain'

// 9 类维度（§7.2 customer_dimension_options）
const DIMENSIONS: { value: CustomerDimension; label: string }[] = [
  { value: 'industry', label: '产业' },
  { value: 'sub_industry', label: '二级行业' },
  { value: 'customer_type', label: '客户类型' },
  { value: 'product_line', label: '产品线' },
  { value: 'source', label: '客户来源' },
  { value: 'complaint_type', label: '客诉类型' },
  { value: 'trade_type', label: '交易性质' },
  { value: 'opportunity_source', label: '商机渠道' },
  { value: 'visit_type', label: '拜访类型' },
]

const dimension = ref<CustomerDimension>('industry')
const acting = ref(false)

// 按选中维度拉取（切换即过滤）
const {
  data: options,
  loading,
  error,
  reload,
} = useQuery('catalog:list', () => listDimensionOptions(dimension.value))
watch(dimension, () => void reload())

const dialog = reactive({
  visible: false,
  isEdit: false,
  id: '',
  name: '',
  sortOrder: 0,
})

function openAdd() {
  dialog.visible = true
  dialog.isEdit = false
  dialog.id = ''
  dialog.name = ''
  dialog.sortOrder = 0
}
function openEdit(option: DimensionOption) {
  dialog.visible = true
  dialog.isEdit = true
  dialog.id = option.id
  dialog.name = option.name
  dialog.sortOrder = option.sortOrder
}

async function handleSave() {
  const name = dialog.name.trim()
  if (!name) return ElMessage.warning('请输入选项名称')
  acting.value = true
  try {
    if (dialog.isEdit) {
      await updateOption(dialog.id, { name, sortOrder: dialog.sortOrder })
    } else {
      await createOption({ dimension: dimension.value, name, sortOrder: dialog.sortOrder })
    }
    ElMessage.success(dialog.isEdit ? '已更新' : '已新增')
    dialog.visible = false
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    acting.value = false
  }
}

async function toggle(option: DimensionOption) {
  try {
    await updateOption(option.id, { isActive: !option.isActive })
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}
</script>

<style scoped>
.catalog {
  padding: var(--crm-spacing-xl);
}
.catalog__card {
  width: 100%;
  max-width: none;
}
</style>
