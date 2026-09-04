export type ReportingPeriod = { kind: 'this-week' | 'last-week' } | { kind: 'month'; month: string }

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
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period.month) || period.month > today.slice(0, 7)) {
      throw new Error('请选择有效的当前或历史月份')
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

export function reportingMonthGroups(today = reportingToday(), years = 3) {
  const currentYear = Number(today.slice(0, 4))
  const currentMonth = Number(today.slice(5, 7))
  return Array.from({ length: years }, (_, offset) => {
    const year = currentYear - offset
    const count = offset === 0 ? currentMonth : 12
    return {
      year,
      months: Array.from({ length: count }, (_, i) => {
        const month = count - i
        return { value: `${year}-${String(month).padStart(2, '0')}`, label: `${year}年${month}月` }
      }),
    }
  })
}
