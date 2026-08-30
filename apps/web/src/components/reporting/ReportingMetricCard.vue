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
  position: relative;
  display: grid;
  gap: 5px;
  min-height: 112px;
  padding: 16px;
  border: 1px solid var(--crm-color-border);
  border-radius: var(--crm-radius-md);
  background: var(--crm-color-bg-soft);
  overflow: hidden;
}
.metric-card span,
.metric-card small {
  color: var(--crm-color-text-secondary);
}
.metric-card strong {
  color: var(--crm-color-text-primary);
  font-size: 24px;
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em;
}
.metric-card::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 3px;
  border-radius: 3px;
  background: var(--crm-color-border-strong);
  content: '';
}
.metric-card--primary::before {
  background: var(--crm-color-primary);
}
.metric-card--warning::before {
  background: var(--crm-color-warning);
}
.metric-card--danger::before {
  background: var(--crm-color-danger);
}
.metric-card--success::before {
  background: var(--crm-color-success);
}
</style>
