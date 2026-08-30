<template>
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path :d="paths[name] ?? paths.work" />
  </svg>
</template>

<script setup lang="ts">
defineProps<{ name: string }>()

const paths: Record<string, string> = {
  work: 'M3 10.5 12 3l9 7.5v9A1.5 1.5 0 0 1 19.5 21h-15A1.5 1.5 0 0 1 3 19.5v-9ZM9 21v-7h6v7',
  customers:
    'M9 11.5A3.5 3.5 0 1 0 9 4.5a3.5 3.5 0 0 0 0 7ZM3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 5.5a3.2 3.2 0 0 1 0 6.2M16.5 14c2.6.4 4 2.3 4.5 5',
  opportunities:
    'M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 3V1M21 12h2',
  complaints: 'M12 3 2.7 20h18.6L12 3ZM12 9v5M12 17.5v.5',
  expenses: 'M5 3h14v18l-2.4-1.5L14.3 21 12 19.5 9.7 21l-2.3-1.5L5 21V3ZM8 8h8M8 12h8M8 16h5',
  management: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  claims: 'M7 7h11l-3-3M18 7l-3 3M17 17H6l3 3M6 17l3-3',
  users:
    'M8.5 11A3.5 3.5 0 1 0 8.5 4a3.5 3.5 0 0 0 0 7ZM2.5 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 8h6M19 5v6M16 15h6M19 12v6',
  catalog:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1A8 8 0 0 0 14.8 6L14.5 3h-5L9.2 6a8 8 0 0 0-1.7 1.1l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1A8 8 0 0 0 9.2 18l.3 3h5l.3-3a8 8 0 0 0 1.7-1.1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z',
  quotas: 'm12 3 9 4.5-9 4.5-9-4.5L12 3Zm-9 9 9 4.5 9-4.5M3 16.5l9 4.5 9-4.5',
}
</script>

<style scoped>
svg {
  width: 17px;
  height: 17px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>
