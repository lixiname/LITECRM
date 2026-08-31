// 生产环境首次初始化：只补充缺失的管理员和基础参考数据，不覆盖任何已有配置或业务数据。
// 运行前必须先执行数据库迁移。可重复执行，但不应放入 API 启动命令。
import { eq } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import { db, pool } from '../src/common/db/db'
import {
  administrativeDivisions,
  customerDimensionOptions,
  salesRegionAreas,
  salesRegions,
  users,
} from '../src/common/db/schema'
import { CITY_GROUPS, PROVINCES, SALES_REGION_SEEDS, SEED_DIMENSIONS } from './seed'

type BootstrapResult = 'created' | 'preserved'

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

async function bootstrapAdmin(): Promise<BootstrapResult> {
  const username = (process.env.BOOTSTRAP_ADMIN_USERNAME ?? 'admin').trim()
  if (!username) throw new Error('BOOTSTRAP_ADMIN_USERNAME 不能为空。')

  const [existing] = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  // 重复执行时绝不改密、改角色或重新启用账号。
  if (existing) {
    if (existing.role !== 'admin') {
      throw new Error(`账号 ${username} 已存在但不是管理员，初始化已停止。`)
    }
    return 'preserved'
  }

  const passwordHash = await bcrypt.hash(readRequiredInitialPassword(), 12)
  await db.insert(users).values({
    username,
    passwordHash,
    displayName: (process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME ?? '系统管理员').trim(),
    jobTitle: (process.env.BOOTSTRAP_ADMIN_JOB_TITLE ?? '系统管理员').trim(),
    role: 'admin',
  })
  return 'created'
}

async function bootstrapDimensions(): Promise<number> {
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

async function bootstrapGeography(): Promise<{
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

    const mappingRows = await db
      .insert(salesRegionAreas)
      .values({ salesRegionId: region.id, divisionCode: regionSeed.divisionCode })
      .onConflictDoNothing()
      .returning({ divisionCode: salesRegionAreas.divisionCode })
    mappings += mappingRows.length
  }

  return { divisions, regions, mappings }
}

async function main() {
  const admin = await bootstrapAdmin()
  const dimensions = await bootstrapDimensions()
  const geography = await bootstrapGeography()
  console.log(
    `基础数据初始化完成：管理员 ${admin === 'created' ? '已创建' : '已保留'}；新增字典 ${dimensions} 项；新增行政区划 ${geography.divisions} 项、销售大区 ${geography.regions} 项、区域映射 ${geography.mappings} 项。`,
  )
}

main()
  .catch((error) => {
    console.error('基础数据初始化失败：', error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
