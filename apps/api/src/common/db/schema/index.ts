// Drizzle schema 入口：所有表在此汇总（drizzle-kit 扫描此文件生成迁移）
import { baseColumns } from './common'
import { capacityConfig, userCapacityOverrides, users } from './org'
import { auditLogs } from './audit'

export { baseColumns, users, capacityConfig, userCapacityOverrides, auditLogs }
