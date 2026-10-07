import { describe, expect, it } from 'vitest'
import { expenseMonthCells, expenseMonthLabel, shiftExpenseMonth } from './expense-calendar'

describe('费用月历', () => {
  it('按周一开始，并正确处理闰年', () => {
    const days = expenseMonthCells('2028-02')
    expect(days).toHaveLength(35)
    expect(days[0]).toBeNull()
    expect(days[1]).toBe('2028-02-01')
    expect(days).toContain('2028-02-29')
    expect(days.at(-1)).toBeNull()
  })

  it('跨年切月并显示中文年月', () => {
    expect(shiftExpenseMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftExpenseMonth('2026-01', -1)).toBe('2025-12')
    expect(expenseMonthLabel('2026-10')).toBe('2026年10月')
  })
})
