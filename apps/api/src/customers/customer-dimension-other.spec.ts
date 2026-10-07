import { describe, expect, it } from 'vitest'
import { resolveCustomerDimensionOther } from './customer-dimension-other'

describe('客户行业/领域其他说明', () => {
  it('只在 other 时保留修剪后的原文', () => {
    expect(resolveCustomerDimensionOther('客户行业', 'other', '  精密陶瓷  ')).toBe('精密陶瓷')
    expect(resolveCustomerDimensionOther('客户行业', 'electroplating', null)).toBeNull()
  })

  it('拒绝空说明、标准项带说明及过长内容', () => {
    expect(() => resolveCustomerDimensionOther('客户行业', 'other', '  ')).toThrow('请填写具体内容')
    expect(() => resolveCustomerDimensionOther('具体领域', 'hardware', '额外内容')).toThrow(
      '只有选择其他',
    )
    expect(() => resolveCustomerDimensionOther('客户行业', 'other', 'a'.repeat(81))).toThrow(
      '不能超过80字',
    )
  })
})
