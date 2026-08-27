import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { baseColumns } from './common'

/** 标准行政区划是参考数据；销售大区是可配置的业务辖区，两者通过映射解耦。 */
export const administrativeDivisions = pgTable(
  'administrative_divisions',
  {
    code: text('code').primaryKey(),
    name: text('name').notNull(),
    level: text('level').notNull(),
    parentCode: text('parent_code'),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    check('administrative_divisions_level_check', sql`${table.level} in ('province','city')`),
    foreignKey({
      columns: [table.parentCode],
      foreignColumns: [table.code],
    }),
    index('administrative_divisions_parent_idx').on(table.parentCode, table.sortOrder),
  ],
)

export const salesRegions = pgTable(
  'sales_regions',
  {
    ...baseColumns,
    code: text('code').notNull(),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [uniqueIndex('sales_regions_code_uq').on(table.code)],
)

/** 一个行政区划节点只归属一个销售大区；解析时城市节点优先于省级节点。 */
export const salesRegionAreas = pgTable(
  'sales_region_areas',
  {
    salesRegionId: uuid('sales_region_id')
      .notNull()
      .references(() => salesRegions.id, { onDelete: 'cascade' }),
    divisionCode: text('division_code')
      .notNull()
      .references(() => administrativeDivisions.code),
  },
  (table) => [
    primaryKey({ columns: [table.salesRegionId, table.divisionCode] }),
    uniqueIndex('sales_region_areas_division_uq').on(table.divisionCode),
  ],
)
