<template>
  <div class="metric-card" :class="tone ? `metric-card--${tone}` : ''">
    <span>{{ label }}</span>
    <strong>{{ value }}</strong>
    <small v-if="hint">{{ hint }}</small>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
  tone?: 'primary' | 'warning' | 'danger' | 'success'
}>()
</script>

<style scoped>
.metric-card {
  display: grid;
  gap: var(--crm-spacing-xs);
  min-height: 112px;
  padding: var(--crm-spacing-lg);
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-card);
}
.metric-card span,
.metric-card small {
  color: var(--crm-color-text-secondary);
}
.metric-card strong {
  font-size: 26px;
  line-height: 1.2;
}
.metric-card--primary {
  border-top: 3px solid var(--crm-color-primary);
}
.metric-card--warning {
  border-top: 3px solid var(--el-color-warning);
}
.metric-card--danger {
  border-top: 3px solid var(--el-color-danger);
}
.metric-card--success {
  border-top: 3px solid var(--el-color-success);
}
</style>
