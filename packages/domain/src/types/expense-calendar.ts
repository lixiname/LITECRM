/** 费用台账月历：周一为每周首日；空位不属于所选月份。 */
export function expenseMonthCells(month: string): (string | null)[] {
  const [year, monthNumber] = month.split('-').map(Number)
  const firstWeekday = (new Date(year!, monthNumber! - 1, 1).getDay() + 6) % 7
  const days = new Date(year!, monthNumber!, 0).getDate()
  const cells: (string | null)[] = Array(firstWeekday).fill(null)
  for (let day = 1; day <= days; day++) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7) cells.push(null)
  return cells
}

export function shiftExpenseMonth(month: string, offset: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const shifted = new Date(year!, monthNumber! - 1 + offset, 1)
  return `${shifted.getFullYear()}-${String(shifted.getMonth() + 1).padStart(2, '0')}`
}

export function expenseMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-')
  return `${year}年${Number(monthNumber)}月`
}
