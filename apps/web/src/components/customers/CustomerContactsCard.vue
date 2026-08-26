<template>
  <el-card class="contacts-card">
    <template #header>
      <div class="contacts-card__header">
        <span>联系人</span>
        <el-button v-if="editable" size="small" @click="openCreate">+ 添加</el-button>
      </div>
    </template>
    <el-table :data="contacts" border empty-text="还没有联系人">
      <el-table-column prop="name" label="姓名" min-width="100">
        <template #default="{ row }">{{ (row as Contact).name || '未命名联系人' }}</template>
      </el-table-column>
      <el-table-column prop="title" label="职位" min-width="100" />
      <el-table-column label="电话" min-width="140">
        <template #default="{ row }">{{ maskPhone((row as Contact).phone) }}</template>
      </el-table-column>
      <el-table-column label="首要" width="70">
        <template #default="{ row }">
          <el-tag v-if="(row as Contact).isKeyContact" size="small" type="success">首要</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="editable" label="操作" width="130" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row as Contact)">编辑</el-button>
          <el-button link type="danger" @click="handleRemove(row as Contact)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog v-model="visible" :title="editingId ? '编辑联系人' : '添加联系人'" width="440px">
      <el-form label-width="80px">
        <el-form-item label="姓名"
          ><el-input v-model="form.name" placeholder="可留空"
        /></el-form-item>
        <el-form-item label="职位"><el-input v-model="form.title" /></el-form-item>
        <el-form-item label="电话" required>
          <el-input v-model="form.phone" placeholder="手机号或座机" />
        </el-form-item>
        <el-form-item label="首要联系人"><el-switch v-model="form.isKeyContact" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="visible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </el-card>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { addContact, removeContact, updateContact, type Contact } from '@crm/domain'
import { maskPhone } from './customer-presentation'

const props = defineProps<{
  customerId: string
  contacts: Contact[]
  editable: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const visible = ref(false)
const saving = ref(false)
const editingId = ref<string>()
const form = reactive({ name: '', title: '', phone: '', isKeyContact: false })

function resetForm(contact?: Contact) {
  editingId.value = contact?.id
  Object.assign(form, {
    name: contact?.name ?? '',
    title: contact?.title ?? '',
    phone: contact?.phone ?? '',
    isKeyContact: contact?.isKeyContact ?? false,
  })
}
function openCreate() {
  resetForm()
  visible.value = true
}
function openEdit(contact: Contact) {
  resetForm(contact)
  visible.value = true
}

async function handleSave() {
  if (!form.phone.trim()) return ElMessage.warning('联系人电话必填')
  saving.value = true
  try {
    const input = {
      name: form.name.trim() || undefined,
      title: form.title.trim() || undefined,
      phone: form.phone.trim(),
      isKeyContact: form.isKeyContact,
    }
    if (editingId.value) await updateContact(editingId.value, input)
    else await addContact(props.customerId, input)
    ElMessage.success(editingId.value ? '联系人已更新' : '联系人已添加')
    visible.value = false
    emit('changed')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleRemove(contact: Contact) {
  try {
    await ElMessageBox.confirm(
      `确认删除联系人“${contact.name || maskPhone(contact.phone)}”吗？`,
      '删除联系人',
      { type: 'warning', confirmButtonText: '删除' },
    )
    await removeContact(contact.id)
    ElMessage.success('联系人已删除')
    emit('changed')
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(error instanceof Error ? error.message : '删除失败')
  }
}
</script>

<style scoped>
.contacts-card {
  margin-bottom: var(--crm-spacing-lg);
}
.contacts-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
</style>
