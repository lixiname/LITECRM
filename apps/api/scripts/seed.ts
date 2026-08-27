// apps/api/scripts/seed.ts
// 正式 seed 流程（M1 权限补强 + M5 字典驱动）：初始化 4 角色账号 + 组织树 + 基础字典，幂等可重复执行
// 运行：pnpm --filter @crm/api db:seed
// 组织树：admin → manager(executive) → sales1/sales2；assistant 独立（full 只读）
import { and, eq, sql } from 'drizzle-orm'
import * as bcrypt from 'bcryptjs'
import { db } from '../src/common/db/db'
import {
  administrativeDivisions,
  customerDimensionOptions,
  customers,
  salesRegionAreas,
  salesRegions,
  users,
} from '../src/common/db/schema'

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

// ===== 基础字典种子（§7.2 字典驱动：M5 重构后字典可配置，seed 提供默认项）=====
export const SEED_DIMENSIONS: { dimension: string; name: string; label: string }[] = [
  // 拜访类型（visit_type）
  { dimension: 'visit_type', name: 'new_customer', label: '新客户开发' },
  { dimension: 'visit_type', name: 'existing_maintenance', label: '存量维护' },
  { dimension: 'visit_type', name: 'industry_relation', label: '行业关系' },
  // 商机发现渠道（opportunity_source）
  { dimension: 'opportunity_source', name: 'referral', label: '转介绍' },
  { dimension: 'opportunity_source', name: 'meeting', label: '会面' },
  { dimension: 'opportunity_source', name: 'self_visit', label: '主动拜访' },
  { dimension: 'opportunity_source', name: 'exhibition', label: '展会' },
  { dimension: 'opportunity_source', name: 'other', label: '其他' },
  // 客诉类型（complaint_type）
  { dimension: 'complaint_type', name: 'product_quality', label: '产品质量' },
  { dimension: 'complaint_type', name: 'service', label: '服务' },
  { dimension: 'complaint_type', name: 'delivery', label: '交付' },
  { dimension: 'complaint_type', name: 'after_sales', label: '售后' },
  { dimension: 'complaint_type', name: 'billing', label: '开票' },
  { dimension: 'complaint_type', name: 'other', label: '其他' },
  // 客户行业（industry）与具体领域（sub_industry）是两个正交维度，不建立父子约束。
  { dimension: 'industry', name: 'manufacturing', label: '制造业' },
  { dimension: 'industry', name: 'electronics', label: '电子行业' },
  { dimension: 'industry', name: 'electroplating', label: '电镀' },
  { dimension: 'industry', name: 'pcb', label: 'PCB' },
  { dimension: 'industry', name: 'energy_storage', label: '储能' },
  { dimension: 'industry', name: 'other', label: '其他' },
  { dimension: 'sub_industry', name: 'hardware', label: '五金' },
  { dimension: 'sub_industry', name: 'automotive', label: '汽车零部件' },
  { dimension: 'sub_industry', name: 'electronic_components', label: '电子元件' },
  { dimension: 'sub_industry', name: 'new_energy', label: '新能源' },
  { dimension: 'sub_industry', name: 'other', label: '其他' },
  // 客户来源（source）
  { dimension: 'source', name: 'self_visit', label: '主动拜访' },
  { dimension: 'source', name: 'referral', label: '转介绍' },
  { dimension: 'source', name: 'exhibition', label: '展会' },
  { dimension: 'source', name: 'other', label: '其他' },
  // 客户类型（customer_type）
  { dimension: 'customer_type', name: 'end_user', label: '终端用户' },
  { dimension: 'customer_type', name: 'integrator', label: '系统集成商' },
  { dimension: 'customer_type', name: 'dealer', label: '经销商' },
  // 产品线（product_line）
  { dimension: 'product_line', name: 'pump', label: '泵浦' },
  { dimension: 'product_line', name: 'filtration_system', label: '成套过滤设备' },
  { dimension: 'product_line', name: 'consumables', label: '滤材与耗材' },
]

// 幂等：维度 + 稳定值已存在时刷新默认展示名，便于测试库升级后直接使用
export async function seedDimensions(): Promise<void> {
  for (const d of SEED_DIMENSIONS) {
    const [exists] = await db
      .select({ id: customerDimensionOptions.id, label: customerDimensionOptions.label })
      .from(customerDimensionOptions)
      .where(
        and(
          eq(customerDimensionOptions.dimension, d.dimension),
          eq(customerDimensionOptions.name, d.name),
        ),
      )
      .limit(1)
    if (exists) {
      if (exists.label !== d.label) {
        await db
          .update(customerDimensionOptions)
          .set({ label: d.label })
          .where(eq(customerDimensionOptions.id, exists.id))
      }
    } else {
      await db.insert(customerDimensionOptions).values(d)
    }
  }
}

type DivisionSeed = {
  code: string
  name: string
  level: 'province' | 'city'
  parentCode?: string
}

const PROVINCES: DivisionSeed[] = [
  { code: '130000', name: '河北省', level: 'province' },
  { code: '320000', name: '江苏省', level: 'province' },
  { code: '330000', name: '浙江省', level: 'province' },
  { code: '440000', name: '广东省', level: 'province' },
]

const CITY_GROUPS: Record<string, [string, string][]> = {
  '130000': [
    ['130100', '石家庄市'],
    ['130200', '唐山市'],
    ['130300', '秦皇岛市'],
    ['130400', '邯郸市'],
    ['130500', '邢台市'],
    ['130600', '保定市'],
    ['130700', '张家口市'],
    ['130800', '承德市'],
    ['130900', '沧州市'],
    ['131000', '廊坊市'],
    ['131100', '衡水市'],
  ],
  '320000': [
    ['320100', '南京市'],
    ['320200', '无锡市'],
    ['320300', '徐州市'],
    ['320400', '常州市'],
    ['320500', '苏州市'],
    ['320600', '南通市'],
    ['320700', '连云港市'],
    ['320800', '淮安市'],
    ['320900', '盐城市'],
    ['321000', '扬州市'],
    ['321100', '镇江市'],
    ['321200', '泰州市'],
    ['321300', '宿迁市'],
  ],
  '330000': [
    ['330100', '杭州市'],
    ['330200', '宁波市'],
    ['330300', '温州市'],
    ['330400', '嘉兴市'],
    ['330500', '湖州市'],
    ['330600', '绍兴市'],
    ['330700', '金华市'],
    ['330800', '衢州市'],
    ['330900', '舟山市'],
    ['331000', '台州市'],
    ['331100', '丽水市'],
  ],
  '440000': [
    ['440100', '广州市'],
    ['440200', '韶关市'],
    ['440300', '深圳市'],
    ['440400', '珠海市'],
    ['440500', '汕头市'],
    ['440600', '佛山市'],
    ['440700', '江门市'],
    ['440800', '湛江市'],
    ['440900', '茂名市'],
    ['441200', '肇庆市'],
    ['441300', '惠州市'],
    ['441400', '梅州市'],
    ['441500', '汕尾市'],
    ['441600', '河源市'],
    ['441700', '阳江市'],
    ['441800', '清远市'],
    ['441900', '东莞市'],
    ['442000', '中山市'],
    ['445100', '潮州市'],
    ['445200', '揭阳市'],
    ['445300', '云浮市'],
  ],
}

const SALES_REGION_SEEDS = [
  { code: 'jiangsu', name: '江苏', divisionCode: '320000' },
  { code: 'ningbo', name: '宁波', divisionCode: '330200' },
  { code: 'wenzhou', name: '温州', divisionCode: '330300' },
  { code: 'taizhou', name: '台州', divisionCode: '331000' },
  { code: 'guangdong', name: '广东', divisionCode: '440000' },
  { code: 'hebei', name: '河北', divisionCode: '130000' },
]

export async function seedGeography(): Promise<void> {
  const divisions = [
    ...PROVINCES,
    ...Object.entries(CITY_GROUPS).flatMap(([parentCode, cities]) =>
      cities.map(([code, name]) => ({ code, name, level: 'city' as const, parentCode })),
    ),
  ]
  for (const [sortOrder, division] of divisions.entries()) {
    await db
      .insert(administrativeDivisions)
      .values({ ...division, sortOrder })
      .onConflictDoUpdate({
        target: administrativeDivisions.code,
        set: {
          name: division.name,
          level: division.level,
          parentCode: division.parentCode ?? null,
          sortOrder,
          isActive: true,
        },
      })
  }

  for (const [sortOrder, region] of SALES_REGION_SEEDS.entries()) {
    const [saved] = await db
      .insert(salesRegions)
      .values({ code: region.code, name: region.name, sortOrder })
      .onConflictDoUpdate({
        target: salesRegions.code,
        set: { name: region.name, sortOrder, isActive: true },
      })
      .returning({ id: salesRegions.id })
    await db
      .insert(salesRegionAreas)
      .values({ salesRegionId: saved.id, divisionCode: region.divisionCode })
      .onConflictDoUpdate({
        target: salesRegionAreas.divisionCode,
        set: { salesRegionId: saved.id },
      })
  }

  // 兼容历史名称字段：能精确匹配的旧客户补齐稳定编码和销售大区。
  await db.execute(sql`
    update ${customers} c set province_code = p.code
    from ${administrativeDivisions} p
    where c.province_code is null and p.level = 'province' and c.province = p.name
  `)
  await db.execute(sql`
    update ${customers} c set city_code = city.code
    from ${administrativeDivisions} city
    where c.city_code is null and city.level = 'city' and c.city = city.name
      and (c.province_code is null or city.parent_code = c.province_code)
  `)
  await db.execute(sql`
    update ${customers} c set sales_region_id = coalesce(
      (select m.sales_region_id from ${salesRegionAreas} m where m.division_code = c.city_code),
      (select m.sales_region_id from ${salesRegionAreas} m where m.division_code = c.province_code)
    )
    where c.sales_region_id is null
  `)
}

// 主模块执行（ts-node scripts/seed.ts 直接跑；被测试 import 时不触发副作用）
if (require.main === module) {
  Promise.all([seedAccounts(), seedDimensions(), seedGeography()])
    .then(([names]) => {
      console.log(`seed 完成：账号 ${names.join(', ')} + 字典 ${SEED_DIMENSIONS.length} 项`)
      process.exit(0)
    })
    .catch((err) => {
      console.error('seed 失败：', err)
      process.exit(1)
    })
}
