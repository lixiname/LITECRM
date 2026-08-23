import { defineConfig } from 'vitest/config'

// domain 共享层独立单测（前后端统一 Vitest，规格 §2）
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
  },
})
