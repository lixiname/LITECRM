import { getComplaint } from './complaints'
import { getOpportunity } from './opportunities'
import { listVisitsByCustomer } from './visits'
import type { WeekBusinessRecord, WeekComplaintRecord } from './week-view'
import {
  OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS,
  OPPORTUNITY_STAGE_OPTIONS,
  VISIT_METHOD_OPTIONS,
} from '../types/actions'

export type ActualRecordReference = WeekBusinessRecord | WeekComplaintRecord

export interface ActualRecordDetail {
  id: string
  type: ActualRecordReference['type']
  title: string
  occurredAt: string
  customerId: string
  customerName: string
  sourcePlanId: string | null
  relatedType: 'customer' | 'opportunity' | 'complaint'
  relatedId: string
  relatedLabel: string
  fields: { label: string; value: string }[]
}

/**
 * 周视图中的“已发生”只是一条事实索引；打开后按事实 id 回查所属聚合，
 * 返回只读详情。这里不暴露任何继续推进或安排下一计划的命令。
 */
export async function getActualRecordDetail(
  record: ActualRecordReference,
): Promise<ActualRecordDetail> {
  if (record.type === 'customer_visit') {
    const visits = await listVisitsByCustomer(record.customerId)
    const visit = visits.find((item) => item.id === record.id)
    if (!visit) throw new Error('拜访记录不存在或已不可见')
    return detail(record, '客户拜访记录', visit.occurredAt, 'customer', record.customerId, [
      ['拜访方式', optionLabel(VISIT_METHOD_OPTIONS, visit.method)],
      ['业务情况', visit.businessSituation],
      ['设备情况', visit.equipmentSituation],
      ['人员变化', visit.personnelChanges],
    ])
  }

  if (record.type === 'complaint_registered' || record.type === 'complaint_follow_up') {
    const complaint = await getComplaint(record.complaintId)
    if (record.type === 'complaint_registered') {
      return detail(record, '客诉登记记录', complaint.occurredAt, 'complaint', complaint.id, [
        ['客诉内容', complaint.description],
        ['当前状态', complaint.status === 'resolved' ? '已解决' : '处理中'],
        ['解决结果', complaint.resolution],
      ])
    }
    const followUp = complaint.followUps.find((item) => item.id === record.id)
    if (!followUp) throw new Error('客诉跟进记录不存在或已不可见')
    return detail(record, '客诉跟进记录', followUp.occurredAt, 'complaint', complaint.id, [
      ['本次处理', followUp.content],
      ['处理结果', followUp.outcome === 'resolved' ? '确认解决' : '继续跟进'],
      ['解决说明', followUp.resolution],
    ])
  }

  if (!('opportunityId' in record)) throw new Error('业务记录类型不受支持')
  const opportunityId = record.opportunityId ?? record.id
  const opportunity = await getOpportunity(opportunityId)
  if (record.type === 'opportunity_created') {
    return detail(
      record,
      '新商机记录',
      `${opportunity.discoveredDate}T12:00:00+08:00`,
      'opportunity',
      opportunity.id,
      [
        ['商机名称', opportunity.name],
        ['当前阶段', optionLabel(OPPORTUNITY_STAGE_OPTIONS, opportunity.stage)],
        ['参考金额', money(opportunity.referenceAmount)],
        ['预计成交日', opportunity.expectedCloseDate],
      ],
    )
  }

  if (record.type === 'opportunity_follow_up') {
    const followUp = opportunity.followUps.find((item) => item.id === record.id)
    if (!followUp) throw new Error('商机推进记录不存在或已不可见')
    const quote = opportunity.quotes.find((item) => item.followUpId === followUp.id)
    return detail(record, '商机推进记录', followUp.occurredAt, 'opportunity', opportunity.id, [
      ['本次结论', followUp.conclusion],
      [
        '沟通方式',
        followUp.method ? optionLabel(OPPORTUNITY_FOLLOW_UP_METHOD_OPTIONS, followUp.method) : null,
      ],
      [
        '本次报价',
        quote ? `${quote.kind === 'formal' ? '正式' : '口头'} · ${money(quote.amount)}` : null,
      ],
      ['报价单号', quote?.quoteNo],
      ['报价说明', quote?.note],
    ])
  }

  const quote = opportunity.quotes.find((item) => item.id === record.id)
  if (!quote) throw new Error('报价记录不存在或已不可见')
  return detail(record, '独立报价记录', quote.quotedAt, 'opportunity', opportunity.id, [
    ['报价类型', quote.kind === 'formal' ? '正式报价' : '口头报价'],
    ['报价金额', money(quote.amount)],
    ['报价单号', quote.quoteNo],
    ['报价说明', quote.note],
    ['状态', quote.status === 'active' ? '当前有效' : '已被替代'],
  ])
}

function detail(
  record: ActualRecordReference,
  title: string,
  occurredAt: string,
  relatedType: ActualRecordDetail['relatedType'],
  relatedId: string,
  values: [string, unknown][],
): ActualRecordDetail {
  return {
    id: record.id,
    type: record.type,
    title,
    occurredAt,
    customerId: record.customerId,
    customerName: record.customerName,
    sourcePlanId: record.sourcePlanId,
    relatedType,
    relatedId,
    relatedLabel:
      relatedType === 'customer'
        ? '查看客户档案'
        : relatedType === 'opportunity'
          ? '查看所属商机'
          : '查看所属客诉',
    fields: values
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([label, value]) => ({ label, value: String(value) })),
  }
}

function optionLabel<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((item) => item.value === value)?.label ?? value
}

function money(value: string | null | undefined): string {
  return value == null ? '-' : `¥${Number(value).toLocaleString('zh-CN')}`
}
