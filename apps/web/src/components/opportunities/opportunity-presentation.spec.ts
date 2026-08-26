import { describe, expect, it } from 'vitest'
import {
  opportunityAmountText,
  opportunityQuoteKindLabel,
  opportunityQuoteStatusLabel,
  opportunityStageLabel,
} from './opportunity-presentation'

describe('商机展示语义', () => {
  it('固定状态全部转换为中文业务名称', () => {
    expect(opportunityStageLabel('intent')).toBe('意向')
    expect(opportunityStageLabel('following')).toBe('跟进中')
    expect(opportunityStageLabel('won')).toBe('已成交')
    expect(opportunityStageLabel('lost')).toBe('已丢失')
    expect(opportunityStageLabel('demand_disappeared')).toBe('需求消失')
    expect(opportunityQuoteKindLabel('oral')).toBe('口头报价')
    expect(opportunityQuoteKindLabel('formal')).toBe('正式报价')
    expect(opportunityQuoteStatusLabel('active')).toBe('有效')
    expect(opportunityQuoteStatusLabel('superseded')).toBe('已被替代')
    expect(opportunityQuoteStatusLabel('withdrawn')).toBe('已撤回')
  })

  it('金额按人民币阅读格式展示', () => {
    expect(opportunityAmountText('430000.00')).toBe('¥430,000')
    expect(opportunityAmountText(null)).toBe('-')
  })
})
