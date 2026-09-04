import { describe, expect, it } from 'vitest'
import {
  reportingToday,
  reportingPeriodRange,
  reportingMonthGroups,
  defaultReportingMonth,
} from './reporting-period'

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
  it('月份只允许指定六个月，包含未来月份并使用完整自然月', () => {
    expect(reportingPeriodRange({ kind: 'month', month: '2027-02' }, '2026-09-04')).toEqual([
      '2027-02-01',
      '2027-02-28',
    ])
    expect(reportingPeriodRange({ kind: 'month', month: '2026-09' }, '2026-09-04')).toEqual([
      '2026-09-01',
      '2026-09-30',
    ])
    expect(() => reportingPeriodRange({ kind: 'month', month: '2026-08' }, '2026-09-04')).toThrow()
    expect(() => reportingPeriodRange({ kind: 'month', month: '2027-03' }, '2026-09-04')).toThrow()
    expect(() => reportingPeriodRange({ kind: 'month', month: '2026-13' }, '2026-09-04')).toThrow()
  })
  it('月份按年份分组倒序且只有六项，业务日期采用中国时区', () => {
    const groups = reportingMonthGroups()
    expect(groups.map((group) => group.year)).toEqual([2027, 2026])
    expect(groups.flatMap((group) => group.months.map((month) => month.value))).toEqual([
      '2027-02',
      '2027-01',
      '2026-12',
      '2026-11',
      '2026-10',
      '2026-09',
    ])
    expect(reportingToday(new Date('2025-12-31T16:01:00Z'))).toBe('2026-01-01')
  })
  it('默认当月，超出指定区间时选择最近的边界月份', () => {
    expect(defaultReportingMonth('2026-09-04')).toBe('2026-09')
    expect(defaultReportingMonth('2027-01-15')).toBe('2027-01')
    expect(defaultReportingMonth('2026-08-31')).toBe('2026-09')
    expect(defaultReportingMonth('2027-03-01')).toBe('2027-02')
  })
})
