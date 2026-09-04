import { describe, expect, it } from 'vitest'
import { reportingToday, reportingPeriodRange, reportingMonthGroups } from './reporting-period'

describe('固定经营周期', () => {
  it('本周和上周按周一到周日，支持跨年', () => {
    expect(reportingPeriodRange({ kind: 'this-week' }, '2026-01-01')).toEqual([
      '2025-12-29',
      '2026-01-04',
    ])
    expect(reportingPeriodRange({ kind: 'last-week' }, '2026-01-01')).toEqual([
      '2025-12-22',
      '2025-12-28',
    ])
    expect(reportingPeriodRange({ kind: 'this-week' }, '2026-09-06')).toEqual([
      '2026-08-31',
      '2026-09-06',
    ])
  })
  it('月份用完整自然月，支持闰年，不允许未来月份', () => {
    expect(reportingPeriodRange({ kind: 'month', month: '2024-02' }, '2026-09-04')).toEqual([
      '2024-02-01',
      '2024-02-29',
    ])
    expect(reportingPeriodRange({ kind: 'month', month: '2026-09' }, '2026-09-04')).toEqual([
      '2026-09-01',
      '2026-09-30',
    ])
    expect(() => reportingPeriodRange({ kind: 'month', month: '2026-10' }, '2026-09-04')).toThrow()
    expect(() => reportingPeriodRange({ kind: 'month', month: '2026-13' }, '2026-09-04')).toThrow()
  })
  it('月份按年份分组倒序，可扩展往年，业务日期采用中国时区', () => {
    const groups = reportingMonthGroups('2026-01-01', 4)
    expect(groups.map((group) => group.year)).toEqual([2026, 2025, 2024, 2023])
    expect(groups[0]!.months).toEqual([{ label: '2026年1月', value: '2026-01' }])
    expect(groups[1]!.months[0]!.value).toBe('2025-12')
    expect(reportingToday(new Date('2025-12-31T16:01:00Z'))).toBe('2026-01-01')
  })
})
