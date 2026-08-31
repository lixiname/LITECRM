<template>
  <el-dialog
    :model-value="modelValue"
    title="计划指导"
    width="560px"
    destroy-on-close
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-if="plan" class="plan-guidance">
      <section class="plan-guidance__context">
        <div>
          <el-tag size="small" effect="plain">{{ planLabel(plan.planKind) }}</el-tag>
          <span>{{ dateText(plan.plannedAt) }}</span>
          <el-tag v-if="plan.status !== 'pending'" size="small" type="info">
            {{ plan.status === 'completed' ? '已执行' : '已取消' }}
          </el-tag>
        </div>
        <strong>{{ plan.customerName }}</strong>
        <span v-if="plan.opportunityName">{{ plan.opportunityName }}</span>
        <p>{{ plan.content }}</p>
      </section>

      <div v-loading="loading" class="plan-guidance__list">
        <el-empty v-if="!loading && !comments.length" description="暂无指导意见" :image-size="72" />
        <article v-for="comment in comments" :key="comment.id" class="plan-guidance__comment">
          <header>
            <strong>{{ comment.authorName }}</strong>
            <span>{{ dateTime(comment.createdAt) }}</span>
          </header>
          <p>{{ comment.content }}</p>
          <small v-if="canComment">{{ comment.readAt ? '对方已读' : '对方未读' }}</small>
        </article>
      </div>

      <section v-if="canComment && plan.status === 'pending'" class="plan-guidance__composer">
        <el-input
          v-model="content"
          type="textarea"
          :rows="3"
          maxlength="500"
          show-word-limit
          placeholder="针对这项计划给出简短、可执行的指导"
        />
        <el-button type="primary" :loading="saving" @click="submit">发布指导</el-button>
      </section>
      <el-alert
        v-else-if="canComment && plan.status !== 'pending'"
        title="计划已结束，历史指导仅供查看"
        type="info"
        :closable="false"
        show-icon
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  createSalesPlanComment,
  listSalesPlanComments,
  markSalesPlanCommentsRead,
  type SalesPlan,
  type SalesPlanComment,
  type SalesPlanKind,
} from '@crm/domain'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    plan?: SalesPlan
    canComment?: boolean
    recipientView?: boolean
  }>(),
  { plan: undefined, canComment: false, recipientView: false },
)
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  changed: []
}>()
const comments = ref<SalesPlanComment[]>([])
const content = ref('')
const loading = ref(false)
const saving = ref(false)

watch(
  () => [props.modelValue, props.plan?.id] as const,
  ([visible]) => {
    if (visible && props.plan) void load()
  },
)

async function load() {
  const plan = props.plan
  if (!plan) return
  loading.value = true
  try {
    comments.value = await listSalesPlanComments(plan.id)
    if (props.recipientView && comments.value.some((comment) => !comment.readAt)) {
      await markSalesPlanCommentsRead(plan.id)
      comments.value = await listSalesPlanComments(plan.id)
      emit('changed')
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '指导意见加载失败')
  } finally {
    loading.value = false
  }
}

async function submit() {
  const plan = props.plan
  if (!plan || !content.value.trim()) return ElMessage.warning('请填写指导内容')
  saving.value = true
  try {
    await createSalesPlanComment(plan.id, content.value.trim())
    content.value = ''
    await load()
    emit('changed')
    ElMessage.success('指导已发布')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '发布失败')
  } finally {
    saving.value = false
  }
}

function planLabel(kind: SalesPlanKind): string {
  return {
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机推进',
    complaint_follow_up: '客诉处理',
  }[kind]
}
function dateText(value: string): string {
  return value.slice(0, 10)
}
function dateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.plan-guidance {
  display: grid;
  gap: var(--crm-spacing-lg);
}
.plan-guidance__context {
  display: grid;
  gap: var(--crm-spacing-xs);
  padding: var(--crm-spacing-md);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-subtle);
}
.plan-guidance__context > div,
.plan-guidance__comment header,
.plan-guidance__composer {
  display: flex;
  align-items: center;
  gap: var(--crm-spacing-sm);
}
.plan-guidance__context p,
.plan-guidance__comment p {
  margin: 0;
  white-space: pre-wrap;
}
.plan-guidance__context span,
.plan-guidance__comment header span,
.plan-guidance__comment small {
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.plan-guidance__list {
  display: grid;
  max-height: 340px;
  gap: var(--crm-spacing-sm);
  overflow-y: auto;
}
.plan-guidance__comment {
  display: grid;
  gap: var(--crm-spacing-xs);
  padding: var(--crm-spacing-md);
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
}
.plan-guidance__comment header {
  justify-content: space-between;
}
.plan-guidance__composer {
  align-items: flex-end;
}
.plan-guidance__composer .el-textarea {
  flex: 1;
}
</style>
