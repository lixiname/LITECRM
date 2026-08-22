import { defineConfig } from 'vitest/config'

// API 统一 Vitest（规格 §2：前后端统一，不用 Jest——避免 jest-resolve→unrs-resolver）
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
})
