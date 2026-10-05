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
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
  overflow: hidden;
  padding: 8px;
  border: 1px solid #c4dff4;
  border-radius: 9px;
  background: linear-gradient(135deg, rgb(255 255 255 / 90%), rgb(227 244 255 / 70%));
  box-shadow: 0 3px 15px rgb(52 136 190 / 8%);
}
.cockpit-metric {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid #e2f1fb;
  border-radius: 5px;
  background: linear-gradient(135deg, rgb(255 255 255 / 90%), rgb(220 239 255 / 65%));
}
.cockpit-metric + .cockpit-metric {
  border-left: 1px solid #e2f1fb;
}
.cockpit-metric:nth-child(5) {
  border-left-width: 1px;
}
.cockpit-metric header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  color: #587a9b;
  font-size: 12px;
}
.cockpit-metric header small {
  padding: 2px 5px;
  border-radius: 3px;
  color: #167ce6;
  background: #e6f4ff;
  font-size: 10px;
  font-weight: 700;
}
.cockpit-metric header small.is-flow {
  color: #078d85;
  background: #e2f7f5;
}
.cockpit-metric > strong {
  display: block;
  margin-top: 5px;
  overflow: hidden;
  color: #123458;
  font-size: clamp(20px, 1.8vw, 27px);
  font-weight: 750;
  letter-spacing: -0.035em;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cockpit-metric p {
  margin: 3px 0 0;
  overflow: hidden;
  color: #6381a0;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cockpit-metric p.is-risk {
  color: #bb741e;
}
@media (max-width: 680px) {
  .cockpit-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
