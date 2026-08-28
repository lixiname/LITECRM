<template>
  <div>
    <van-nav-bar
      :title="plan ? '执行客诉计划' : '记录客诉处理'"
      left-arrow
      @click-left="router.back()"
    />
    <van-notice-bar
      v-if="plan"
      wrapable
      :scrollable="false"
      :text="`本次执行计划：${plan.content}`"
    />
    <van-form @submit="submit">
      <van-cell-group inset>
        <van-field v-model="content" label="处理情况" type="textarea" rows="3" required />
        <van-switch-cell v-model="resolved" title="本次已解决" />
        <van-field v-if="resolved" v-model="resolution" label="解决结果" required />
        <template v-else>
          <van-field v-model="nextAt" label="下次时间" type="datetime-local" required />
          <van-field v-model="nextContent" label="下次内容" required />
        </template>
      </van-cell-group>
      <div class="submit">
        <van-button block round type="primary" native-type="submit" :loading="saving"
          >保存处理结果</van-button
        >
      </div>
    </van-form>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showToast } from 'vant'
import {
  followUpComplaint,
  getComplaint,
  getSalesPlan,
  type ComplaintDetail,
  type SalesPlan,
} from '@crm/domain'
const route = useRoute()
const router = useRouter()
const complaintId = String(route.params.id)
const detail = ref<ComplaintDetail>()
const plan = ref<SalesPlan>()
const content = ref('')
const resolved = ref(false)
const resolution = ref('')
const nextAt = ref(tomorrowAtNine())
const nextContent = ref('')
const saving = ref(false)
onMounted(async () => {
  try {
    ;[detail.value, plan.value] = await Promise.all([
      getComplaint(complaintId),
      route.query.planId ? getSalesPlan(String(route.query.planId)) : Promise.resolve(undefined),
    ])
    const currentPlan = plan.value ? undefined : detail.value?.actions[0]
    if (currentPlan) {
      nextAt.value = localInput(new Date(currentPlan.plannedAt))
      nextContent.value = currentPlan.content
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '加载失败')
  }
})
async function submit() {
  if (!detail.value || !content.value.trim()) return
  if (resolved.value && !resolution.value.trim()) return showToast('请填写解决结果')
  if (!resolved.value && (!nextAt.value || !nextContent.value.trim()))
    return showToast('请填写下一处理计划')
  saving.value = true
  try {
    await followUpComplaint(complaintId, {
      version: detail.value.version,
      content: content.value.trim(),
      outcome: resolved.value ? 'resolved' : 'followed_up',
      resolution: resolved.value ? resolution.value.trim() : undefined,
      sourcePlanId: plan.value?.id,
      nextActionAt: resolved.value ? undefined : new Date(nextAt.value).toISOString(),
      nextActionContent: resolved.value ? undefined : nextContent.value.trim(),
    })
    showToast('处理结果已保存')
    router.back()
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}
function tomorrowAtNine() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(9, 0, 0, 0)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
function localInput(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}
</script>
<style scoped>
.submit {
  margin: var(--crm-spacing-lg) var(--crm-spacing-md);
}
</style>
