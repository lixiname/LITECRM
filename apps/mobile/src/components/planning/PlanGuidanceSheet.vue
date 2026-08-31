<template>
  <van-popup
    :show="modelValue"
    position="bottom"
    round
    closeable
    :style="{ maxHeight: '78vh' }"
    @update:show="emit('update:modelValue', $event)"
  >
    <div v-if="plan" class="plan-guidance-sheet">
      <header>
        <h3>计划指导</h3>
        <div>
          <van-tag plain type="primary">{{ planLabel(plan.planKind) }}</van-tag>
          <span>{{ plan.plannedAt.slice(0, 10) }}</span>
        </div>
        <strong>{{ plan.customerName }}</strong>
        <small v-if="plan.opportunityName">{{ plan.opportunityName }}</small>
        <p>{{ plan.content }}</p>
      </header>

      <van-loading v-if="loading" class="plan-guidance-sheet__loading" />
      <van-empty v-else-if="!comments.length" description="暂无指导意见" :image-size="64" />
      <section v-else class="plan-guidance-sheet__list">
        <article v-for="comment in comments" :key="comment.id">
          <div>
            <strong>{{ comment.authorName }}</strong>
            <small>{{ dateTime(comment.createdAt) }}</small>
          </div>
          <p>{{ comment.content }}</p>
        </article>
      </section>
    </div>
  </van-popup>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { showToast } from 'vant'
import {
  listSalesPlanComments,
  markSalesPlanCommentsRead,
  type SalesPlan,
  type SalesPlanComment,
  type SalesPlanKind,
} from '@crm/domain'

const props = defineProps<{ modelValue: boolean; plan?: SalesPlan }>()
const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  changed: []
}>()
const comments = ref<SalesPlanComment[]>([])
const loading = ref(false)

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
    if (comments.value.some((comment) => !comment.readAt)) {
      await markSalesPlanCommentsRead(plan.id)
      comments.value = await listSalesPlanComments(plan.id)
      emit('changed')
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '指导意见加载失败')
  } finally {
    loading.value = false
  }
}

function planLabel(kind: SalesPlanKind): string {
  return {
    customer_visit: '客户拜访',
    opportunity_follow_up: '商机推进',
    complaint_follow_up: '客诉处理',
  }[kind]
}
function dateTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}
</script>

<style scoped>
.plan-guidance-sheet {
  display: grid;
  gap: var(--crm-spacing-md);
  padding: var(--crm-spacing-lg);
  overflow-y: auto;
}
.plan-guidance-sheet > header {
  display: grid;
  gap: var(--crm-spacing-xs);
  padding-right: var(--crm-spacing-xl);
}
.plan-guidance-sheet h3,
.plan-guidance-sheet p {
  margin: 0;
}
.plan-guidance-sheet > header > div,
.plan-guidance-sheet article > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--crm-spacing-sm);
}
.plan-guidance-sheet small,
.plan-guidance-sheet > header span {
  color: var(--crm-color-text-secondary);
}
.plan-guidance-sheet__loading {
  margin: var(--crm-spacing-lg) auto;
}
.plan-guidance-sheet__list {
  display: grid;
  gap: var(--crm-spacing-sm);
}
.plan-guidance-sheet article {
  display: grid;
  gap: var(--crm-spacing-xs);
  padding: var(--crm-spacing-md);
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-soft);
}
.plan-guidance-sheet article p {
  white-space: pre-wrap;
}
</style>
