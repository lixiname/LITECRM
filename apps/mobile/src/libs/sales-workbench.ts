import type {
  ActionWeekView,
  SalesPlan,
  WeekBusinessRecord,
  WeekComplaintRecord,
} from '@crm/domain'

export type MobileActualRecord = WeekBusinessRecord | WeekComplaintRecord

export interface MobileWeekDay {
  date: string
  weekday: string
  monthDay: string
  isToday: boolean
  pendingPlans: SalesPlan[]
  closedPlans: SalesPlan[]
  businessRecords: WeekBusinessRecord[]
  complaintRecords: WeekComplaintRecord[]
  actualRecords: MobileActualRecord[]
  hasContent: boolean
}

export function buildMobileWeekDays(
  monday: string,
  today: string,
  view?: ActionWeekView | null,
): MobileWeekDay[] {
  const plansByDate = groupByDate(view?.plans ?? [], (item) => item.plannedAt)
  const businessByDate = groupByDate(view?.businessRecords ?? [], (item) => item.occurredAt)
  const complaintByDate = groupByDate(view?.complaintRecords ?? [], (item) => item.occurredAt)

  return Array.from({ length: 7 }, (_, index) => {
    const value = new Date(`${monday}T00:00:00`)
    value.setDate(value.getDate() + index)
    const date = localDate(value)
    const plans = plansByDate.get(date) ?? []
    const pendingPlans = plans.filter((item) => item.status === 'pending')
    const closedPlans = plans.filter((item) => item.status !== 'pending')
    const businessRecords = (businessByDate.get(date) ?? []).sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    const complaintRecords = (complaintByDate.get(date) ?? []).sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    const actualRecords: MobileActualRecord[] = [...businessRecords, ...complaintRecords]
    return {
      date,
      weekday: `周${'一二三四五六日'[(value.getDay() + 6) % 7]}`,
      monthDay: `${value.getMonth() + 1}/${value.getDate()}`,
      isToday: date === today,
      pendingPlans,
      closedPlans,
      businessRecords,
      complaintRecords,
      actualRecords,
      hasContent: plans.length > 0 || actualRecords.length > 0,
    }
  })
}

export function salesPlanExecutionRoute(plan: SalesPlan): string {
  const query = `planId=${encodeURIComponent(plan.id)}`
  if (plan.planKind === 'opportunity_follow_up') {
    return `/opportunities/${plan.opportunityId}/follow-up?${query}`
  }
  if (plan.planKind === 'complaint_follow_up') {
    return `/complaints/${plan.complaintId}/follow-up?${query}`
  }
  return `/customers/${plan.customerId}/visit/new?${query}`
}

export function actualRecordRoute(record: MobileActualRecord, plan?: SalesPlan): string {
  const params = new URLSearchParams({
    customerId: record.customerId,
    customerName: record.customerName,
  })
  if ('opportunityId' in record && record.opportunityId) {
    params.set('opportunityId', record.opportunityId)
    if (record.opportunityName) params.set('opportunityName', record.opportunityName)
  }
  if ('complaintId' in record) params.set('complaintId', record.complaintId)
  if (record.sourcePlanId) params.set('sourcePlanId', record.sourcePlanId)
  if (plan) {
    params.set('planAt', plan.plannedAt)
    params.set('planContent', plan.content)
  }
  return `/records/${record.type}/${record.id}?${params.toString()}`
}

function groupByDate<T>(items: T[], value: (item: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>()
  for (const item of items) {
    const date = value(item).slice(0, 10)
    result.set(date, [...(result.get(date) ?? []), item])
  }
  return result
}

export function localDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
