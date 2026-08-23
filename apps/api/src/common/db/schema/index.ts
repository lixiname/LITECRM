// Drizzle schema 入口：所有表在此汇总（drizzle-kit 扫描此文件生成迁移）
import { baseColumns } from './common'
import { capacityConfig, userCapacityOverrides, users } from './org'
import { auditLogs } from './audit'
import {
  contacts,
  customerClaimRequests,
  customerDimensionOptions,
  customers,
  customerTransfers,
} from './customers'

export {
  baseColumns,
  users,
  capacityConfig,
  userCapacityOverrides,
  auditLogs,
  customers,
  contacts,
  customerTransfers,
  customerClaimRequests,
  customerDimensionOptions,
}
