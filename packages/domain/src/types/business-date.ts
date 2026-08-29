/** 按使用者本地时区返回业务日期，避免 UTC 转换造成日期偏移。 */
export function localBusinessDate(value: Date = new Date()): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** 业务日期只在早于今天时才算逾期；当天仍是待处理。 */
export function isBusinessDateOverdue(value?: string | null, today = localBusinessDate()): boolean {
  return Boolean(value && value < today)
}
