<template>
  <header class="app-page-header">
    <div class="app-page-header__heading">
      <el-button v-if="backTo" link class="app-page-header__back" @click="goBack">
        <span aria-hidden="true">←</span>
        {{ backLabel }}
      </el-button>
      <div>
        <div v-if="eyebrow" class="app-page-header__eyebrow">{{ eyebrow }}</div>
        <h1 class="app-page-header__title">{{ title }}</h1>
        <p v-if="description" class="app-page-header__description">{{ description }}</p>
      </div>
    </div>
    <div v-if="$slots.actions" class="app-page-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    title: string
    eyebrow?: string
    description?: string
    backTo?: string
    backLabel?: string
  }>(),
  { eyebrow: undefined, description: undefined, backTo: undefined, backLabel: '返回' },
)

const router = useRouter()

function goBack() {
  if (props.backTo) void router.push(props.backTo)
}
</script>

<style scoped>
.app-page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--crm-spacing-lg);
  margin-bottom: 18px;
  padding: 0;
}
.app-page-header__heading {
  display: flex;
  align-items: flex-start;
  gap: var(--crm-spacing-sm);
  min-width: 0;
}
.app-page-header__back {
  flex: none;
  margin-top: 3px;
  padding-inline: 0;
  color: var(--crm-color-text-secondary);
}
.app-page-header__eyebrow {
  margin-bottom: 4px;
  color: var(--crm-color-primary);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.app-page-header__title {
  margin: 0;
  color: var(--crm-color-text-primary);
  font-size: var(--crm-font-size-xl);
  line-height: 30px;
  letter-spacing: -0.035em;
  font-weight: 730;
}
.app-page-header__description {
  margin: 6px 0 0;
  color: var(--crm-color-text-secondary);
  font-size: var(--crm-font-size-xs);
}
.app-page-header__actions {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: flex-end;
  gap: var(--crm-spacing-sm);
  flex-wrap: wrap;
}

@media (max-width: 900px) {
  .app-page-header {
    align-items: flex-start;
    flex-direction: column;
  }
  .app-page-header__actions {
    justify-content: flex-start;
  }
}
</style>
