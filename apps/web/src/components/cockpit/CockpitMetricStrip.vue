<template>
  <section class="cockpit-metrics" aria-label="核心经营指标">
    <article v-for="metric in metrics" :key="metric.label" class="cockpit-metric">
      <header>
        <span>{{ metric.label }}</span>
        <small :class="`is-${metric.scopeTone ?? 'stock'}`">{{ metric.scope }}</small>
      </header>
      <strong>{{ metric.value }}</strong>
      <p :class="{ 'is-risk': metric.risk }">{{ metric.hint }}</p>
    </article>
  </section>
</template>

<script setup lang="ts">
export interface CockpitMetric {
  label: string
  scope: string
  scopeTone?: 'stock' | 'flow'
  value: string
  hint: string
  risk?: boolean
}

defineProps<{ metrics: CockpitMetric[] }>()
</script>

<style scoped>
.cockpit-metrics {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  overflow: hidden;
  border: 1px solid #d8e2dd;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 8px 24px rgb(31 62 51 / 5%);
}
.cockpit-metric {
  min-width: 0;
  padding: 13px 15px 12px;
}
.cockpit-metric + .cockpit-metric {
  border-left: 1px solid #e2e9e5;
}
.cockpit-metric:nth-child(5) {
  border-left-width: 5px;
  border-left-color: #edf2ef;
}
.cockpit-metric header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #66766e;
  font-size: 12px;
}
.cockpit-metric header small {
  padding: 2px 5px;
  border-radius: 3px;
  color: #275b49;
  background: #e5f0eb;
  font-size: 10px;
  font-weight: 700;
}
.cockpit-metric header small.is-flow {
  color: #365f76;
  background: #e8f0f4;
}
.cockpit-metric > strong {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: #172a23;
  font-size: clamp(20px, 1.55vw, 27px);
  font-weight: 750;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cockpit-metric p {
  margin: 3px 0 0;
  overflow: hidden;
  color: #718078;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cockpit-metric p.is-risk {
  color: #aa504c;
}
@media (max-width: 1360px) {
  .cockpit-metrics {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .cockpit-metric:nth-child(4) {
    border-left: 0;
  }
  .cockpit-metric:nth-child(n + 4) {
    border-top: 1px solid #e2e9e5;
  }
  .cockpit-metric:nth-child(5) {
    border-left-width: 1px;
    border-left-color: #e2e9e5;
  }
}
</style>
