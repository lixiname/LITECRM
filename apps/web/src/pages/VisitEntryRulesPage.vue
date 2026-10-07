<template>
  <div class="visit-entry-rules">
    <AppPageHeader title="拜访填报规则" description="配置拜访记录的文字下限，只校验新提交的记录" />

    <el-alert type="info" :closable="false" show-icon class="visit-entry-rules__notice">
      两项均以去掉首尾空白后的字符数计算。设为 0 表示不附加字数下限；下次拜访内容仍须填写。
      调整规则不会修改或重新校验历史拜访记录。
    </el-alert>

    <el-card v-loading="loading" class="visit-entry-rules__card" shadow="never">
      <AppQueryState :error="error" @retry="reload" />
      <el-form v-if="loaded && !error" label-width="180px">
        <el-form-item label="本次情况最少字数">
          <el-input-number
            v-model="form.businessSituationMinLength"
            :min="0"
            :max="1000"
            :step="1"
            step-strictly
            controls-position="right"
          />
        </el-form-item>
        <el-form-item label="下次拜访内容最少字数">
          <el-input-number
            v-model="form.nextActionContentMinLength"
            :min="0"
            :max="1000"
            :step="1"
            step-strictly
            controls-position="right"
          />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="save">保存规则</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import AppPageHeader from '../components/AppPageHeader.vue'
import AppQueryState from '../components/AppQueryState.vue'
import { getVisitEntryRules, updateVisitEntryRules, type VisitEntryRules } from '@crm/domain'

const form = reactive<VisitEntryRules>({
  businessSituationMinLength: 0,
  nextActionContentMinLength: 0,
})
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const error = ref<string>()

onMounted(() => void reload())

async function reload() {
  loading.value = true
  error.value = undefined
  try {
    Object.assign(form, await getVisitEntryRules())
    loaded.value = true
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '拜访填报规则加载失败'
  } finally {
    loading.value = false
  }
}

async function save() {
  if (
    ![form.businessSituationMinLength, form.nextActionContentMinLength].every(
      (value) => Number.isInteger(value) && value >= 0 && value <= 1000,
    )
  ) {
    ElMessage.warning('字数下限应为 0 到 1000 的整数')
    return
  }
  saving.value = true
  try {
    Object.assign(form, await updateVisitEntryRules({ ...form }))
    ElMessage.success('拜访填报规则已更新')
  } catch (cause) {
    ElMessage.error(cause instanceof Error ? cause.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.visit-entry-rules {
  padding: var(--crm-spacing-xl);
}
.visit-entry-rules__notice,
.visit-entry-rules__card {
  max-width: 820px;
  margin-bottom: var(--crm-spacing-md);
}
</style>
