<template>
  <div class="grade-quotas">
    <AppPageHeader
      title="客户分级名额"
      description="控制每位负责人可维护的在案客户数量，避免高等级客户资源失焦"
    />

    <el-alert class="grade-quotas__rule" type="info" :closable="false" show-icon>
      <template #title>名额只统计负责人名下的在案客户</template>
      公海与无效客户不占名额。调低上限不会自动释放已有客户；若当前占用超过上限，系统会标记超额并阻止继续流入。
    </el-alert>

    <el-card class="grade-quotas__defaults" shadow="never">
      <template #header>
        <div class="section-heading">
          <div>
            <strong>公司默认名额</strong>
            <span>人员未单独配置时继承此处规则</span>
          </div>
          <el-button type="primary" :loading="savingDefaults" @click="saveDefaults">
            保存默认名额
          </el-button>
        </div>
      </template>

      <div class="default-grid">
        <div v-for="grade in GRADES" :key="grade" class="default-item">
          <span class="grade-mark" :class="`grade-mark--${grade.toLowerCase()}`">{{ grade }}</span>
          <div class="default-item__field">
            <span>{{ grade }} 级客户</span>
            <el-input-number
              v-model="defaultForms[grade]"
              :disabled="defaultUnlimited[grade]"
              :min="0"
              :max="9999"
              controls-position="right"
            />
          </div>
          <el-checkbox v-model="defaultUnlimited[grade]">不限</el-checkbox>
        </div>
      </div>
    </el-card>

    <el-card class="grade-quotas__people" shadow="never">
      <template #header>
        <div class="section-heading section-heading--people">
          <div>
            <strong>人员名额与占用</strong>
            <span>自定义规则优先于公司默认名额</span>
          </div>
          <el-input
            v-model="keyword"
            class="people-search"
            clearable
            placeholder="搜索姓名、账号或区域"
          />
        </div>
      </template>

      <el-table
        v-if="!error && filteredUsers.length"
        v-loading="loading"
        :data="filteredUsers"
        border
      >
        <el-table-column label="负责人" min-width="190" fixed>
          <template #default="{ row }">
            <div class="person-cell">
              <strong>{{ (row as UserGradeQuotaSummary).displayName }}</strong>
              <span>
                {{ ROLE_LABELS[(row as UserGradeQuotaSummary).role] }} ·
                {{ (row as UserGradeQuotaSummary).region || '未配置区域' }}
              </span>
            </div>
          </template>
        </el-table-column>
        <el-table-column
          v-for="grade in GRADES"
          :key="grade"
          :label="`${grade} 级`"
          min-width="150"
        >
          <template #default="{ row }">
            <QuotaUsageCell :quota="quotaOf(row as UserGradeQuotaSummary, grade)" />
          </template>
        </el-table-column>
        <el-table-column label="账号状态" width="94" align="center">
          <template #default="{ row }">
            <el-tag :type="(row as UserGradeQuotaSummary).isActive ? 'success' : 'info'">
              {{ (row as UserGradeQuotaSummary).isActive ? '启用' : '停用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="openUserDialog(row as UserGradeQuotaSummary)">
              配置
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <AppQueryState
        :error="error"
        :empty="!loading && !filteredUsers.length"
        empty-text="暂无可承担客户归属的人员"
        @retry="reload"
      />
    </el-card>

    <el-dialog
      v-model="userDialog.visible"
      :title="`${userDialog.displayName} · 分级名额`"
      width="720px"
    >
      <el-table :data="userDialog.items" border>
        <el-table-column label="客户等级" width="96" align="center">
          <template #default="{ row }">
            <span class="grade-mark" :class="`grade-mark--${row.grade.toLowerCase()}`">
              {{ row.grade }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="used" label="当前在案" width="96" align="center" />
        <el-table-column label="公司默认" width="110" align="center">
          <template #default="{ row }">{{ limitLabel(defaultLimit(row.grade)) }}</template>
        </el-table-column>
        <el-table-column label="个人策略" min-width="170">
          <template #default="{ row }">
            <el-select v-model="row.mode" style="width: 100%">
              <el-option label="继承公司默认" value="inherit" />
              <el-option label="自定义上限" value="limited" />
              <el-option label="不限" value="unlimited" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="自定义上限" width="140">
          <template #default="{ row }">
            <el-input-number
              v-if="row.mode === 'limited'"
              v-model="row.limit"
              :min="0"
              :max="9999"
              controls-position="right"
              style="width: 112px"
            />
            <span v-else class="muted">—</span>
          </template>
        </el-table-column>
        <el-table-column label="保存后" width="100" align="center">
          <template #default="{ row }">
            <el-tag
              :type="
                previewExceeded(row) ? 'danger' : previewAtCapacity(row) ? 'warning' : 'success'
              "
            >
              {{ previewState(row) }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-alert
        v-if="dialogHasExceeded"
        class="dialog-warning"
        type="warning"
        :closable="false"
        show-icon
        title="保存后存在已超额等级；已有客户保持不变，新的客户流入将被拦截。"
      />

      <template #footer>
        <el-button @click="userDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="savingUser" @click="saveUserQuotas">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, defineComponent, h, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, ElTag } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import {
  getGradeQuotaOverview,
  updateGradeQuotaDefaults,
  updateUserGradeQuotas,
  useQuery,
  type CustomerGradeQuotaMode,
  type UserGradeQuota,
  type UserGradeQuotaSummary,
} from '@crm/domain'

const GRADES = ['S', 'A', 'B', 'C'] as const
type Grade = (typeof GRADES)[number]

const ROLE_LABELS: Record<string, string> = {
  sales: '销售人员',
  executive: '销售经理',
}

interface UserQuotaFormItem {
  grade: Grade
  used: number
  mode: CustomerGradeQuotaMode
  limit: number
}

const { data, loading, error, reload } = useQuery('grade-quotas:overview', getGradeQuotaOverview)
const keyword = ref('')
const savingDefaults = ref(false)
const savingUser = ref(false)
const defaultForms = reactive<Record<Grade, number>>({ S: 0, A: 0, B: 0, C: 0 })
const defaultUnlimited = reactive<Record<Grade, boolean>>({ S: true, A: true, B: true, C: true })
const userDialog = reactive({
  visible: false,
  userId: '',
  displayName: '',
  items: [] as UserQuotaFormItem[],
})

watch(
  () => data.value?.defaults,
  (defaults) => {
    if (!defaults) return
    for (const item of defaults) {
      const grade = item.grade as Grade
      defaultUnlimited[grade] = item.limit === null
      defaultForms[grade] = item.limit ?? 0
    }
  },
  { immediate: true },
)

const filteredUsers = computed(() => {
  const normalized = keyword.value.trim().toLowerCase()
  if (!normalized) return data.value?.users ?? []
  return (data.value?.users ?? []).filter((user) =>
    [user.displayName, user.username, user.region ?? ''].some((value) =>
      value.toLowerCase().includes(normalized),
    ),
  )
})

const dialogHasExceeded = computed(() => userDialog.items.some(previewExceeded))

const QuotaUsageCell = defineComponent({
  props: { quota: { type: Object as () => UserGradeQuota, required: true } },
  setup(props) {
    return () =>
      h('div', { class: 'quota-cell' }, [
        h('div', { class: 'quota-cell__number' }, [
          h('strong', String(props.quota.used)),
          h('span', ` / ${limitLabel(props.quota.effectiveLimit)}`),
        ]),
        h(
          ElTag,
          {
            size: 'small',
            type: props.quota.exceeded ? 'danger' : props.quota.atCapacity ? 'warning' : 'info',
            effect: 'plain',
          },
          () =>
            props.quota.exceeded
              ? '已超额'
              : props.quota.mode === 'inherit'
                ? '继承默认'
                : props.quota.mode === 'unlimited'
                  ? '个人不限'
                  : '个人上限',
        ),
      ])
  },
})

function quotaOf(user: UserGradeQuotaSummary, grade: Grade): UserGradeQuota {
  return user.quotas.find((quota) => quota.grade === grade) as UserGradeQuota
}

function defaultLimit(grade: Grade): number | null {
  return defaultUnlimited[grade] ? null : defaultForms[grade]
}

function limitLabel(limit: number | null): string {
  return limit === null ? '不限' : String(limit)
}

async function saveDefaults() {
  savingDefaults.value = true
  try {
    data.value = await updateGradeQuotaDefaults({
      items: GRADES.map((grade) => ({ grade, limit: defaultLimit(grade) })),
    })
    ElMessage.success('公司默认名额已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    savingDefaults.value = false
  }
}

function openUserDialog(user: UserGradeQuotaSummary) {
  userDialog.userId = user.userId
  userDialog.displayName = user.displayName
  userDialog.items = GRADES.map((grade) => {
    const quota = quotaOf(user, grade)
    return {
      grade,
      used: quota.used,
      mode: quota.mode,
      limit: quota.overrideLimit ?? quota.effectiveLimit ?? 0,
    }
  })
  userDialog.visible = true
}

function previewLimit(item: UserQuotaFormItem): number | null {
  if (item.mode === 'unlimited') return null
  if (item.mode === 'limited') return item.limit
  return defaultLimit(item.grade)
}

function previewExceeded(item: UserQuotaFormItem): boolean {
  const limit = previewLimit(item)
  return limit !== null && item.used > limit
}

function previewAtCapacity(item: UserQuotaFormItem): boolean {
  const limit = previewLimit(item)
  return limit !== null && item.used >= limit
}

function previewState(item: UserQuotaFormItem): string {
  const limit = previewLimit(item)
  if (limit === null) return '不限'
  if (item.used > limit) return `超 ${item.used - limit}`
  if (item.used === limit) return '已满'
  return `余 ${limit - item.used}`
}

async function saveUserQuotas() {
  if (dialogHasExceeded.value) {
    try {
      await ElMessageBox.confirm(
        '保存后已有客户不会变化，但超额等级将无法再建档、认领、移交或接管。是否继续？',
        '确认保存超额配置',
        { type: 'warning', confirmButtonText: '仍然保存', cancelButtonText: '返回调整' },
      )
    } catch {
      return
    }
  }

  savingUser.value = true
  try {
    data.value = await updateUserGradeQuotas(userDialog.userId, {
      items: userDialog.items.map((item) => ({
        grade: item.grade,
        mode: item.mode,
        ...(item.mode === 'limited' ? { limit: item.limit } : {}),
      })),
    })
    userDialog.visible = false
    ElMessage.success('个人分级名额已保存')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    savingUser.value = false
  }
}
</script>

<style scoped>
.grade-quotas {
  padding: var(--crm-spacing-xl);
}
.grade-quotas__rule,
.grade-quotas__defaults {
  margin-bottom: var(--crm-spacing-lg);
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-lg);
}
.section-heading strong,
.section-heading span {
  display: block;
}
.section-heading strong {
  color: var(--crm-color-text-primary);
  font-size: 16px;
}
.section-heading span {
  margin-top: 3px;
  color: var(--crm-color-text-secondary);
  font-size: 13px;
}
.default-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(180px, 1fr));
  gap: 12px;
}
.default-item {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-page);
}
.default-item__field {
  min-width: 0;
  flex: 1;
}
.default-item__field > span {
  display: block;
  margin-bottom: 7px;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
.default-item__field :deep(.el-input-number) {
  width: 100%;
}
.grade-mark {
  display: inline-flex;
  width: 30px;
  height: 30px;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  border-radius: 7px;
  font-weight: 700;
}
.grade-mark--s {
  background: #fff1f0;
  color: #cf1322;
}
.grade-mark--a {
  background: #fff7e6;
  color: #ad6800;
}
.grade-mark--b {
  background: #e6f4ff;
  color: #0958d9;
}
.grade-mark--c {
  background: #f0f0f0;
  color: #595959;
}
.people-search {
  width: 260px;
}
.person-cell strong,
.person-cell span {
  display: block;
}
.person-cell strong {
  color: var(--crm-color-text-primary);
}
.person-cell span {
  margin-top: 3px;
  color: var(--crm-color-text-secondary);
  font-size: 12px;
}
:deep(.quota-cell) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
:deep(.quota-cell__number strong) {
  color: var(--crm-color-text-primary);
  font-size: 16px;
}
:deep(.quota-cell__number span),
.muted {
  color: var(--crm-color-text-secondary);
}
.dialog-warning {
  margin-top: 16px;
}
@media (max-width: 1100px) {
  .default-grid {
    grid-template-columns: repeat(2, minmax(220px, 1fr));
  }
}
</style>
