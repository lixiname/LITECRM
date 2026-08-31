import { and, eq } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import { db, pool } from '../src/common/db/db'
import {
  customerDimensionOptions,
  customerGradeQuotaDefaults,
  salesRegions,
  users,
} from '../src/common/db/schema'
import { PRODUCTION_ACCOUNT_SPECS } from './bootstrap'
import { SEED_DIMENSIONS } from './seed'

const EXPECTED_QUOTAS = { S: 20, A: 40, B: 60, C: 80 } as const

export async function verifyBootstrapData(): Promise<void> {
  const accountRows = await db.select().from(users)
  const accountByUsername = new Map(accountRows.map((row) => [row.username, row]))

  for (const spec of PRODUCTION_ACCOUNT_SPECS) {
    const row = accountByUsername.get(spec.username)
    if (!row) throw new Error(`缺少正式账号：${spec.username}`)
    if (
      row.displayName !== spec.displayName ||
      row.jobTitle !== spec.jobTitle ||
      row.role !== spec.role
    ) {
      throw new Error(`正式账号资料不符：${spec.username}`)
    }
    const expectedManagerId = spec.reportsTo ? accountByUsername.get(spec.reportsTo)?.id : null
    if (row.reportsToId !== expectedManagerId) {
      throw new Error(`正式账号汇报关系不符：${spec.username}`)
    }
  }

  const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD
  const staffSuffix = process.env.BOOTSTRAP_STAFF_PASSWORD_SUFFIX
  if (adminPassword || staffSuffix) {
    if (!adminPassword || !staffSuffix) {
      throw new Error('校验初始密码时必须同时提供管理员密码和员工密码后缀。')
    }
    for (const spec of PRODUCTION_ACCOUNT_SPECS) {
      const expectedPassword =
        spec.role === 'admin' ? adminPassword : `${spec.username}${staffSuffix}`
      if (
        !expectedPassword ||
        !(await bcrypt.compare(
          expectedPassword,
          accountByUsername.get(spec.username)!.passwordHash,
        ))
      ) {
        throw new Error(`正式账号初始密码校验失败：${spec.username}`)
      }
    }
  }

  for (const item of SEED_DIMENSIONS) {
    const [row] = await db
      .select({ label: customerDimensionOptions.label })
      .from(customerDimensionOptions)
      .where(
        and(
          eq(customerDimensionOptions.dimension, item.dimension),
          eq(customerDimensionOptions.name, item.name),
        ),
      )
      .limit(1)
    if (!row || row.label !== item.label) {
      throw new Error(`基础字典缺失或名称不符：${item.dimension}/${item.name}`)
    }
  }

  const quotaRows = await db.select().from(customerGradeQuotaDefaults)
  const quotaByGrade = new Map(quotaRows.map((row) => [row.grade, row.defaultLimit]))
  for (const grade of Object.keys(EXPECTED_QUOTAS) as (keyof typeof EXPECTED_QUOTAS)[]) {
    const limit = EXPECTED_QUOTAS[grade]
    if (quotaByGrade.get(grade) !== limit) throw new Error(`客户分级默认名额不符：${grade}`)
  }

  const [pumpRegion] = await db
    .select({ name: salesRegions.name })
    .from(salesRegions)
    .where(eq(salesRegions.code, 'pump'))
    .limit(1)
  if (pumpRegion?.name !== '泵浦') throw new Error('缺少泵浦销售大区')

  console.log(
    `正式基础数据校验通过：账号 ${PRODUCTION_ACCOUNT_SPECS.length} 个、字典 ${SEED_DIMENSIONS.length} 项、分级名额 4 项、泵浦大区 1 项。`,
  )
}

if (require.main === module) {
  verifyBootstrapData()
    .catch((error) => {
      console.error('正式基础数据校验失败：', error)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
