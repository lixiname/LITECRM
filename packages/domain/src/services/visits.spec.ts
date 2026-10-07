import { describe, expect, it } from 'vitest'
import { DEFAULT_VISIT_ENTRY_RULES, visitEntryValidationError, visitTextLength } from './visits'

describe('拜访填报前端提示', () => {
  it('默认不增加下限，但下次拜访内容仍必填', () => {
    expect(visitEntryValidationError(DEFAULT_VISIT_ENTRY_RULES, '', '下次再访')).toBeUndefined()
    expect(visitEntryValidationError(DEFAULT_VISIT_ENTRY_RULES, '', '  ')).toBe(
      '请填写下次拜访内容',
    )
  })

  it('按去掉首尾空白后的字符数分别检查两个字段', () => {
    const rules = { businessSituationMinLength: 4, nextActionContentMinLength: 5 }
    expect(visitTextLength(' 生产线 ')).toBe(3)
    expect(visitEntryValidationError(rules, ' 生产线 ', '下周确认预算')).toContain(
      '本次情况至少填写 4 字',
    )
    expect(visitEntryValidationError(rules, '生产线扩建', '  下周去 ')).toContain(
      '下次拜访内容至少填写 5 字',
    )
    expect(visitEntryValidationError(rules, '生产线扩建', '下周确认预算')).toBeUndefined()
  })
})
