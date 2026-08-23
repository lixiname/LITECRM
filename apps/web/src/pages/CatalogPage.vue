<template>
  <div class="catalog">
    <header class="catalog__header">
      <h1 class="catalog__title">字典配置</h1>
      <div class="catalog__actions">
        <el-select v-model="dimension" style="width: 160px" @change="load">
          <el-option v-for="d in DIMENSIONS" :key="d.value" :label="d.label" :value="d.value" />
        </el-select>
        <el-button type="primary" @click="showAdd = true">新增选项</el-button>
        <el-button @click="router.push('/')">返回首页</el-button>
      </div>
    </header>

    <el-card class="catalog__card">
      <el-table v-loading="loading" :data="options ?? []" border>
        <el-table-column prop="name" label="名称" min-width="140" />
        <el-table-column prop="sortOrder" label="排序" width="80" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              size="small"
              :type="row.isActive ? 'danger' : 'success'"
              @click="toggle(row as DimensionOption)"
            >
              {{ row.isActive ? '停用' : '启用' }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="showAdd" title="新增字典选项" width="400px">
      <el-form label-width="70px">
        <el-form-item label="名称" required>
          <el-input v-model="newName" placeholder="选项名称" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="handleAdd">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  useQuery,
  listAllOptions,
  createOption,
  updateOption,
  type DimensionOption,
  type CustomerDimension,
} from '@crm/domain'

const router = useRouter()
const DIMENSIONS = [
  { value: 'industry', label: '产业' },
  { value: 'sub_industry', label: '二级行业' },
  { value: 'customer_type', label: '客户类型' },
  { value: 'product_line', label: '产品线' },
  { value: 'source', label: '客户来源' },
]
const dimension = ref('industry')
const showAdd = ref(false)
const newName = ref('')
const acting = ref(false)

const { data: options, loading, reload } = useQuery('catalog:all', listAllOptions)

function load() {
  void reload()
}

async function handleAdd() {
  if (!newName.value.trim()) return ElMessage.warning('请输入选项名称')
  acting.value = true
  try {
    await createOption({
      dimension: dimension.value as CustomerDimension,
      name: newName.value.trim(),
    })
    ElMessage.success('已新增')
    newName.value = ''
    showAdd.value = false
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '新增失败')
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
.catalog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--crm-spacing-lg);
}
.catalog__title {
  margin: 0;
  color: var(--crm-color-text-primary);
}
.catalog__actions {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-sm);
}
.catalog__card {
  max-width: 720px;
}
</style>
