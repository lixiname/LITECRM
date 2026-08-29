const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

import { Matches } from 'class-validator'

export function IsBusinessDate() {
  return Matches(DATE_PATTERN, { message: '日期必须使用 YYYY-MM-DD 格式' })
}

export function businessDate(value: string | Date): string {
  if (typeof value === 'string' && DATE_PATTERN.test(value)) return value
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function todayBusinessDate(): string {
  return businessDate(new Date())
}
