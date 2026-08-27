// Drizzle schema 入口：所有表在此汇总（drizzle-kit 扫描此文件生成迁移）
import { baseColumns } from './common'
import { customerGradeQuotaDefaults, userCustomerGradeQuotaOverrides, users } from './org'
import { auditLogs } from './audit'
import { administrativeDivisions, salesRegionAreas, salesRegions } from './geography'
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
  opportunityFollowUps,
  opportunityProductLines,
  opportunityQuotes,
  visitRecords,
} from './actions'
import {
  businessWeeks,
  dailyExpenses,
  followUpActions,
  managementComments,
  weeklyPlans,
} from './planning'

export {
  baseColumns,
  users,
  customerGradeQuotaDefaults,
  userCustomerGradeQuotaOverrides,
  auditLogs,
  administrativeDivisions,
  salesRegions,
  salesRegionAreas,
  customers,
  contacts,
  customerTransfers,
  customerClaimRequests,
  customerDimensionOptions,
  customerGradeChanges,
  visitRecords,
  opportunities,
  opportunityFollowUps,
  opportunityProductLines,
  opportunityQuotes,
  opportunityEvents,
  deals,
  complaints,
  complaintFollowUps,
  businessWeeks,
  weeklyPlans,
  followUpActions,
  managementComments,
  dailyExpenses,
}
