import { drizzle } from 'drizzle-orm/node-postgres'
import { config } from 'dotenv'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { Pool } from 'pg'
import * as schema from './schema'

// 从启动目录向上定位 monorepo 根；不依赖 __dirname，避免编译后多一层 dist 导致读错 .env。
function resolveWorkspaceEnv(startDirectory = process.cwd()): string {
  let current = resolve(startDirectory)
  while (true) {
    if (existsSync(resolve(current, 'pnpm-workspace.yaml'))) return resolve(current, '.env')
    const parent = dirname(current)
    if (parent === current) return resolve(startDirectory, '.env')
    current = parent
  }
}

config({ path: resolveWorkspaceEnv() })

// 惰性连接池：仅当执行 SQL 时才真正连库（M0 不连库，M1 业务模块接入后使用）
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? 'postgres://crm:crm_dev_password@localhost:5432/litecrm',
})

export const db = drizzle(pool, { schema })

// 事务 client 类型（供跨模块联动传 tx，如拜访→周计划项强一致）
export type DbClient = Parameters<Parameters<typeof db.transaction>[0]>[0]
