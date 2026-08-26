import { defineConfig } from 'vitest/config'

// API 统一 Vitest（规格 §2：前后端统一，不用 Jest——避免 jest-resolve→unrs-resolver）
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.spec.ts'],
    // API e2e 共用同一 PostgreSQL 测试库；文件并行会互相占用客户名额并破坏清理边界。
    fileParallelism: false,
  },
})
