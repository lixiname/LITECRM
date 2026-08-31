// 生产环境首次初始化：只补充缺失的管理员和基础参考数据，不覆盖任何已有配置或业务数据。
// 运行前必须先执行数据库迁移。可重复执行，但不应放入 API 启动命令。
import { eq } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import { db, pool } from '../src/common/db/db'
import {
  administrativeDivisions,
  customerGradeQuotaDefaults,
  customerDimensionOptions,
  salesRegionAreas,
  salesRegions,
  users,
} from '../src/common/db/schema'
import type { Role } from '../src/common/constants'
import { CITY_GROUPS, PROVINCES, SALES_REGION_SEEDS, SEED_DIMENSIONS } from './seed'

interface ProductionAccountSpec {
  username: string
  displayName: string
  jobTitle: string
  role: Role
  reportsTo?: string
}

export const PRODUCTION_ACCOUNT_SPECS: ProductionAccountSpec[] = [
  {
    username: 'admin',
    displayName: '系统管理员',
    jobTitle: 'IT',
    role: 'admin',
  },
  {
    username: 'wangjunjian',
    displayName: '王军舰',
    jobTitle: 'CEO',
    role: 'management',
  },
  {
    username: 'wangfei',
    displayName: '王飞',
    jobTitle: '副总裁',
    role: 'executive',
    reportsTo: 'wangjunjian',
  },
  {
    username: 'ouyangyanhai',
    displayName: '欧阳',
    jobTitle: '总监',
    role: 'executive',
    reportsTo: 'wangfei',
  },
  {
    username: 'yangjun',
    displayName: '杨军',
    jobTitle: '总监',
    role: 'executive',
    reportsTo: 'ouyangyanhai',
  },
  {
    username: 'cuijielong',
    displayName: '崔介龙',
    jobTitle: '高级经理',
    role: 'executive',
    reportsTo: 'yangjun',
  },
  {
    username: 'cuixing',
    displayName: '崔星',
    jobTitle: '业务员',
    role: 'sales',
    reportsTo: 'cuijielong',
  },
  {
    username: 'wangju',
    displayName: '王菊',
    jobTitle: '业务助理',
    role: 'assistant',
  },
  {
    username: 'xiongguangju',
    displayName: '熊光菊',
    jobTitle: '人事BP',
    role: 'assistant',
  },
]

const readRequiredInitialPassword = (): string => {
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD
  if (!password) {
    throw new Error(
      '首次初始化缺少 BOOTSTRAP_ADMIN_PASSWORD；请通过部署平台密钥配置注入，禁止写入仓库。',
    )
  }
  if (password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD 至少需要 12 个字符。')
  }
  return password
}

function readRequiredStaffPasswordSuffix(): string {
  const suffix = process.env.BOOTSTRAP_STAFF_PASSWORD_SUFFIX
  if (!suffix) {
    throw new Error('首次初始化缺少 BOOTSTRAP_STAFF_PASSWORD_SUFFIX；请通过部署平台密钥配置注入。')
  }
  return suffix
}

export async function bootstrapAccounts(): Promise<{ created: number; preserved: number }> {
  const existingRows = await db
    .select({ id: users.id, username: users.username, role: users.role })
    .from(users)
  const idByUsername = new Map(existingRows.map((row) => [row.username, row.id]))
  const missing = PRODUCTION_ACCOUNT_SPECS.filter((spec) => !idByUsername.has(spec.username))
  const adminPassword = missing.some((spec) => spec.role === 'admin')
    ? readRequiredInitialPassword()
    : undefined
  const staffSuffix = missing.some((spec) => spec.role !== 'admin')
    ? readRequiredStaffPasswordSuffix()
    : undefined
  let created = 0

  for (const spec of PRODUCTION_ACCOUNT_SPECS) {
    if (idByUsername.has(spec.username)) continue
    const reportsToId = spec.reportsTo ? idByUsername.get(spec.reportsTo) : undefined
    if (spec.reportsTo && !reportsToId) {
      throw new Error(`账号 ${spec.username} 的上级 ${spec.reportsTo} 尚不存在，初始化已停止。`)
    }
    const password = spec.role === 'admin' ? adminPassword : `${spec.username}${staffSuffix}`
    if (!password || password.length < 8) {
      throw new Error(`账号 ${spec.username} 的初始密码长度不足 8 位。`)
    }
    const [saved] = await db
      .insert(users)
      .values({
        username: spec.username,
        passwordHash: await bcrypt.hash(password, 12),
        displayName: spec.displayName,
        jobTitle: spec.jobTitle,
        role: spec.role,
        reportsToId: reportsToId ?? null,
      })
      .returning({ id: users.id })
    idByUsername.set(spec.username, saved.id)
    created += 1
  }
  return { created, preserved: PRODUCTION_ACCOUNT_SPECS.length - created }
}

export async function bootstrapDimensions(): Promise<number> {
  let inserted = 0
  for (const item of SEED_DIMENSIONS) {
    const rows = await db
      .insert(customerDimensionOptions)
      .values(item)
      .onConflictDoNothing()
      .returning({ id: customerDimensionOptions.id })
    inserted += rows.length
  }
  return inserted
}

export async function bootstrapGradeQuotas(): Promise<number> {
  const defaults = [
    { grade: 'S' as const, defaultLimit: 20 },
    { grade: 'A' as const, defaultLimit: 40 },
    { grade: 'B' as const, defaultLimit: 60 },
    { grade: 'C' as const, defaultLimit: 80 },
  ]
  let inserted = 0
  for (const item of defaults) {
    const rows = await db
      .insert(customerGradeQuotaDefaults)
      .values(item)
      .onConflictDoNothing()
      .returning({ grade: customerGradeQuotaDefaults.grade })
    inserted += rows.length
  }
  return inserted
}

export async function bootstrapGeography(): Promise<{
  divisions: number
  regions: number
  mappings: number
}> {
  let divisions = 0
  let regions = 0
  let mappings = 0
  const divisionSeeds = [
    ...PROVINCES,
    ...Object.entries(CITY_GROUPS).flatMap(([parentCode, cities]) =>
      cities.map(([code, name]) => ({
        code,
        name,
        level: 'city' as const,
        parentCode,
      })),
    ),
  ]

  for (const [sortOrder, division] of divisionSeeds.entries()) {
    const rows = await db
      .insert(administrativeDivisions)
      .values({ ...division, sortOrder })
      .onConflictDoNothing()
      .returning({ code: administrativeDivisions.code })
    divisions += rows.length
  }

  for (const [sortOrder, regionSeed] of SALES_REGION_SEEDS.entries()) {
    const insertedRows = await db
      .insert(salesRegions)
      .values({ code: regionSeed.code, name: regionSeed.name, sortOrder })
      .onConflictDoNothing()
      .returning({ id: salesRegions.id })
    regions += insertedRows.length

    const [region] = insertedRows.length
      ? insertedRows
      : await db
          .select({ id: salesRegions.id })
          .from(salesRegions)
          .where(eq(salesRegions.code, regionSeed.code))
          .limit(1)
    if (!region) throw new Error(`销售大区 ${regionSeed.code} 初始化后仍不存在。`)

    if (regionSeed.divisionCode) {
      const mappingRows = await db
        .insert(salesRegionAreas)
        .values({ salesRegionId: region.id, divisionCode: regionSeed.divisionCode })
        .onConflictDoNothing()
        .returning({ divisionCode: salesRegionAreas.divisionCode })
      mappings += mappingRows.length
    }
  }

  return { divisions, regions, mappings }
}

export async function bootstrapProductionData() {
  const accounts = await bootstrapAccounts()
  const dimensions = await bootstrapDimensions()
  const gradeQuotas = await bootstrapGradeQuotas()
  const geography = await bootstrapGeography()
  console.log(
    `基础数据初始化完成：账号新增 ${accounts.created}、保留 ${accounts.preserved}；新增字典 ${dimensions} 项；新增分级名额 ${gradeQuotas} 项；新增行政区划 ${geography.divisions} 项、销售大区 ${geography.regions} 项、区域映射 ${geography.mappings} 项。`,
  )
}

if (require.main === module) {
  bootstrapProductionData()
    .catch((error) => {
      console.error('基础数据初始化失败：', error)
      process.exitCode = 1
    })
    .finally(() => pool.end())
}
