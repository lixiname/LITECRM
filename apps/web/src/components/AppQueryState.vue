<template>
  <el-result v-if="error" icon="error" title="加载失败" :sub-title="error">
    <template #extra>
      <el-button type="primary" @click="$emit('retry')">重新加载</el-button>
    </template>
  </el-result>
  <el-empty v-else-if="empty" :description="emptyText" />
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    error?: string | null
    empty?: boolean
    emptyText?: string
  }>(),
  { error: null, empty: false, emptyText: '暂无数据' },
)

defineEmits<{ retry: [] }>()
</script>
