// apps/api/scripts/seed.ts
// 正式 seed 流程（M1 权限补强）：初始化 4 角色账号 + 组织树，幂等可重复执行
// 运行：pnpm --filter @crm/api db:seed
// 组织树：admin → manager(executive) → sales1/sales2；assistant 独立（full 只读）
import * as bcrypt from 'bcryptjs'
import { db } from '../src/common/db/db'
import { users } from '../src/common/db/schema'

export interface SeedAccount {
  username: string
  password: string
  displayName: string
  role: string
  reportsTo?: string // 上级用户名（组织树）
}

export const SEED_ACCOUNTS: SeedAccount[] = [
  { username: 'admin', password: 'Admin@123456', displayName: '系统管理员', role: 'admin' },
  {
    username: 'manager',
    password: 'Crm@123456',
    displayName: '华东销售经理',
    role: 'executive',
    reportsTo: 'admin',
  },
  {
    username: 'sales1',
    password: 'Crm@123456',
    displayName: '销售甲',
    role: 'sales',
    reportsTo: 'manager',
  },
  {
    username: 'sales2',
    password: 'Crm@123456',
    displayName: '销售乙',
    role: 'sales',
    reportsTo: 'manager',
  },
  { username: 'assistant', password: 'Crm@123456', displayName: '业务助理', role: 'assistant' },
]

// 幂等：账号已存在则更新（displayName/密码/角色/上级/启用），不存在的则插入
export async function seedAccounts(): Promise<string[]> {
  const idByUsername = new Map<string, string>()
  for (const row of await db.select({ id: users.id, username: users.username }).from(users)) {
    idByUsername.set(row.username, row.id)
  }

  for (const acc of SEED_ACCOUNTS) {
    const passwordHash = await bcrypt.hash(acc.password, 10)
    // 组织树按 SEED_ACCOUNTS 顺序插入（父先于子），reportsToId 始终可解析
    const reportsToId = acc.reportsTo ? (idByUsername.get(acc.reportsTo) ?? null) : null
    const [row] = await db
      .insert(users)
      .values({
        username: acc.username,
        displayName: acc.displayName,
        passwordHash,
        role: acc.role,
        reportsToId,
      })
      .onConflictDoUpdate({
        target: users.username,
        set: {
          displayName: acc.displayName,
          passwordHash,
          role: acc.role,
          reportsToId,
          isActive: true,
        },
      })
      .returning({ id: users.id, username: users.username })
    idByUsername.set(row.username, row.id)
  }
  return SEED_ACCOUNTS.map((a) => a.username)
}

// 主模块执行（ts-node scripts/seed.ts 直接跑；被测试 import 时不触发副作用）
if (require.main === module) {
  seedAccounts()
    .then((names) => {
      console.log(`seed 完成：${names.join(', ')}`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('seed 失败：', err)
      process.exit(1)
    })
}
