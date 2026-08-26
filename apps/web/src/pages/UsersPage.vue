<template>
  <div class="users">
    <AppPageHeader title="用户管理" description="维护账号、角色和组织内使用状态">
      <template #actions>
        <el-button type="primary" @click="openAdd">新建用户</el-button>
      </template>
    </AppPageHeader>

    <el-card class="users__card">
      <el-table v-if="!error && users?.length" v-loading="loading" :data="users" border>
        <el-table-column prop="username" label="用户名" min-width="120" />
        <el-table-column prop="displayName" label="显示名" min-width="120" />
        <el-table-column label="上级" min-width="130">
          <template #default="{ row }">{{ getUserName((row as User).reportsToId) }}</template>
        </el-table-column>
        <el-table-column label="角色" min-width="100">
          <template #default="{ row }">
            {{ ROLE_LABELS[row.role as Role] }}
          </template>
        </el-table-column>
        <el-table-column prop="phone" label="手机号" min-width="110" />
        <el-table-column prop="region" label="区域" min-width="80" />
        <el-table-column label="状态" min-width="90">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'danger'">
              {{ row.isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="220">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row as User)">编辑</el-button>
            <el-button
              size="small"
              :type="row.isActive ? 'danger' : 'success'"
              @click="toggleActive(row as User)"
              >{{ row.isActive ? '停用' : '启用' }}</el-button
            >
            <el-button size="small" @click="resetPassword(row as User)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
      <AppQueryState
        :error="error"
        :empty="!loading && !users?.length"
        empty-text="暂无用户"
        @retry="reload"
      />
    </el-card>

    <el-dialog
      v-model="dialog.visible"
      :title="dialog.isEdit ? '编辑用户' : '新建用户'"
      width="540px"
    >
      <el-form label-width="80px">
        <el-form-item label="登录名" required>
          <el-input v-model="dialog.username" :disabled="dialog.isEdit" placeholder="登录用户名" />
        </el-form-item>
        <el-form-item v-if="!dialog.isEdit" label="初始密码" required>
          <el-input
            v-model="dialog.password"
            type="password"
            placeholder="不少于 8 位"
            show-password
          />
        </el-form-item>
        <el-form-item label="显示名" required>
          <el-input v-model="dialog.displayName" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="dialog.role" style="width: 100%">
            <el-option
              v-for="(label, value) in ROLE_LABELS"
              :key="value"
              :label="label"
              :value="value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="上级">
          <el-select
            v-model="dialog.reportsToId"
            clearable
            filterable
            placeholder="可选（空表示顶层）"
            style="width: 100%"
          >
            <el-option
              v-for="u in usersWithoutSelf"
              :key="u.id"
              :label="`${u.displayName}（${u.username}）`"
              :value="u.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="dialog.phone" placeholder="可选" />
        </el-form-item>
        <el-form-item label="区域">
          <el-input v-model="dialog.region" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="acting" @click="saveUser">确认</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import {
  createUser,
  deactivateUser,
  listUsers,
  resetUserPassword,
  ROLE_LABELS,
  type CreateUserInput,
  type UpdateUserInput,
  updateUser,
  useQuery,
  type Role,
  type User,
} from '@crm/domain'

const { data: users, loading, error, reload } = useQuery('users:list', listUsers)

const acting = ref(false)
const dialog = reactive({
  visible: false,
  isEdit: false,
  id: '',
  username: '',
  password: '',
  displayName: '',
  role: 'sales' as Role,
  reportsToId: '',
  phone: '',
  region: '',
})

const usersWithoutSelf = computed(() => {
  if (!users.value) return []
  return users.value.filter((u) => !(dialog.isEdit && u.id === dialog.id))
})
const userNameById = computed(() => {
  const map = new Map<string, string>()
  for (const u of users.value ?? []) map.set(u.id, `${u.displayName}（${u.username}）`)
  return map
})

function getUserName(id: string | null | undefined): string {
  if (!id) return '-'
  return userNameById.value.get(id) ?? '—'
}

function openAdd() {
  dialog.visible = true
  dialog.isEdit = false
  dialog.id = ''
  dialog.username = ''
  dialog.password = ''
  dialog.displayName = ''
  dialog.role = 'sales'
  dialog.reportsToId = ''
  dialog.phone = ''
  dialog.region = ''
}

function openEdit(u: User) {
  dialog.visible = true
  dialog.isEdit = true
  dialog.id = u.id
  dialog.username = u.username
  dialog.password = ''
  dialog.displayName = u.displayName
  dialog.role = u.role as Role
  dialog.reportsToId = u.reportsToId ?? ''
  dialog.phone = u.phone ?? ''
  dialog.region = u.region ?? ''
}

async function saveUser() {
  const displayName = dialog.displayName.trim()
  if (!displayName) return ElMessage.warning('显示名不能为空')

  if (!dialog.isEdit) {
    if (!dialog.password || dialog.password.length < 8) {
      return ElMessage.warning('初始密码不少于 8 位')
    }
    if (!dialog.username.trim()) {
      return ElMessage.warning('登录名不能为空')
    }
  }

  acting.value = true
  try {
    if (dialog.isEdit) {
      const dto: UpdateUserInput = {
        displayName,
        role: dialog.role,
        reportsToId: dialog.reportsToId || null,
        phone: dialog.phone.trim() || undefined,
        region: dialog.region.trim() || undefined,
      }
      await updateUser(dialog.id, dto)
      ElMessage.success('已更新')
    } else {
      const dto: CreateUserInput = {
        username: dialog.username.trim(),
        password: dialog.password,
        displayName,
        role: dialog.role,
        reportsToId: dialog.reportsToId || undefined,
        phone: dialog.phone.trim() || undefined,
        region: dialog.region.trim() || undefined,
      }
      await createUser(dto)
      ElMessage.success('已新增')
    }
    dialog.visible = false
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    acting.value = false
  }
}

async function toggleActive(user: User) {
  try {
    await ElMessageBox.confirm(
      user.isActive
        ? '停用后该用户将无法登录，且现有登录会话会失效，是否继续？'
        : '恢复启用后该用户可继续登录，是否继续？',
      user.isActive ? '确认停用' : '确认启用',
      { confirmButtonText: user.isActive ? '停用' : '启用', cancelButtonText: '取消' },
    )
  } catch {
    return
  }
  try {
    if (user.isActive) {
      await deactivateUser(user.id)
      ElMessage.success('已停用')
    } else {
      await updateUser(user.id, { isActive: true })
      ElMessage.success('已启用')
    }
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function resetPassword(user: User) {
  try {
    await ElMessageBox.confirm(
      `确定重置 ${user.displayName} 的密码吗？结果仅可展示一次。`,
      '确认重置',
      { confirmButtonText: '重置', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  try {
    const temporary = await resetUserPassword(user.id)
    await ElMessageBox.alert(
      `临时密码：${temporary}\n请线下通知用户，并要求首次登录后重置。`,
      '重置成功',
      {
        confirmButtonText: '我知道了',
        type: 'success',
      },
    )
    await reload()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}
</script>

<style scoped>
.users {
  padding: var(--crm-spacing-xl);
}
.users__card {
  width: 100%;
  max-width: none;
}
</style>
