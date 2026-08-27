import { drizzle } from 'drizzle-orm/node-postgres'
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { Pool } from 'pg'
import * as schema from './schema'

// API、迁移与 seed 无论从仓库根目录还是 workspace 启动，都读取同一份根 .env。
config({ path: resolve(__dirname, '../../../../../.env') })

// 惰性连接池：仅当执行 SQL 时才真正连库（M0 不连库，M1 业务模块接入后使用）
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://crm:crm_dev_password@localhost:5432/litecrm',
})

export const db = drizzle(pool, { schema })

// 事务 client 类型（供跨模块联动传 tx，如拜访→周计划项强一致）
export type DbClient = Parameters<Parameters<typeof db.transaction>[0]>[0]
