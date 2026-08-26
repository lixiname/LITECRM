// Drizzle schema 入口：所有表在此汇总（drizzle-kit 扫描此文件生成迁移）
import { baseColumns } from './common'
import { customerGradeQuotaDefaults, userCustomerGradeQuotaOverrides, users } from './org'
import { auditLogs } from './audit'
import {
  contacts,
  customerClaimRequests,
  customerDimensionOptions,
  customerGradeChanges,
  customers,
  customerTransfers,
} from './customers'
import {
  complaintFollowUps,
  complaints,
  deals,
  opportunities,
  opportunityEvents,
  visitRecords,
} from './actions'
import {
  businessWeeks,
  dailyExpenses,
  managementComments,
  weeklyPlanItems,
  weeklyPlans,
} from './planning'

export {
  baseColumns,
  users,
  customerGradeQuotaDefaults,
  userCustomerGradeQuotaOverrides,
  auditLogs,
  customers,
  contacts,
  customerTransfers,
  customerClaimRequests,
  customerDimensionOptions,
  customerGradeChanges,
  visitRecords,
  opportunities,
  opportunityEvents,
  deals,
  complaints,
  complaintFollowUps,
  businessWeeks,
  weeklyPlans,
  weeklyPlanItems,
  managementComments,
  dailyExpenses,
}
