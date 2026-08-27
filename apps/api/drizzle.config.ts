import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(__dirname, '../../.env') })

// Drizzle 迁移配置（规格 §7：迁移驱动，synchronize 退役）
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/common/db/schema/index.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://crm:crm_dev_password@localhost:5432/litecrm',
  },
})
