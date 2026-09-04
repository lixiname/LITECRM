export type ReportingPeriod = { kind: 'this-week' | 'last-week' } | { kind: 'month'; month: string }

const FIRST_REPORTING_MONTH = '2026-09'
const LAST_REPORTING_MONTH = '2027-02'

export function defaultReportingMonth(today = reportingToday()): string {
  const month = today.slice(0, 7)
  return month < FIRST_REPORTING_MONTH
    ? FIRST_REPORTING_MONTH
    : month > LAST_REPORTING_MONTH
      ? LAST_REPORTING_MONTH
      : month
}

// 与后端报表采用同一业务时区；用 UTC 运算自然日，避免浏览器时区和夏令时干扰。
export function reportingToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function reportingPeriodRange(
  period: ReportingPeriod,
  today = reportingToday(),
): [string, string] {
  const iso = (date: Date) => date.toISOString().slice(0, 10)
  if (period.kind === 'month') {
    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(period.month) ||
      period.month < FIRST_REPORTING_MONTH ||
      period.month > LAST_REPORTING_MONTH
    ) {
      throw new Error('请选择2026年9月至2027年2月的月份')
    }
    const [year, month] = period.month.split('-').map(Number)
    return [`${period.month}-01`, iso(new Date(Date.UTC(year!, month!, 0)))]
  }
  const monday = new Date(`${today}T00:00:00Z`)
  monday.setUTCDate(
    monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - (period.kind === 'last-week' ? 7 : 0),
  )
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  return [iso(monday), iso(sunday)]
}

export function reportingMonthGroups() {
  const groups: { year: number; months: { value: string; label: string }[] }[] = []
  const cursor = new Date(`${LAST_REPORTING_MONTH}-01T00:00:00Z`)
  while (cursor.toISOString().slice(0, 7) >= FIRST_REPORTING_MONTH) {
    const year = cursor.getUTCFullYear()
    let group = groups.at(-1)
    if (!group || group.year !== year) {
      group = { year, months: [] }
      groups.push(group)
    }
    group.months.push({
      value: cursor.toISOString().slice(0, 7),
      label: `${year}年${cursor.getUTCMonth() + 1}月`,
    })
    cursor.setUTCMonth(cursor.getUTCMonth() - 1)
  }
  return groups
}
