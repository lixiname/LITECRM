import { describe, expect, it } from 'vitest'
import {
  businessWeekRange,
  isBusinessDate,
  shiftBusinessDate,
  startOfBusinessWeek,
} from './week-view'

describe('business week navigation', () => {
  it('normalizes any selected date to Monday through Sunday', () => {
    expect(startOfBusinessWeek('2026-08-29')).toBe('2026-08-24')
    expect(businessWeekRange('2026-08-29')).toEqual({
      monday: '2026-08-24',
      sunday: '2026-08-30',
    })
  })

  it('moves across month and year boundaries using local dates', () => {
    expect(shiftBusinessDate('2026-08-31', 7)).toBe('2026-09-07')
    expect(shiftBusinessDate('2026-12-28', 7)).toBe('2027-01-04')
  })

  it('rejects malformed route dates', () => {
    expect(isBusinessDate('2026-08-29')).toBe(true)
    expect(isBusinessDate('2026-02-30')).toBe(false)
    expect(isBusinessDate('not-a-date')).toBe(false)
  })
})
