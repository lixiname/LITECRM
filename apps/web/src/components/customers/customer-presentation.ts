export function maskPhone(phone?: string | null): string {
  if (!phone) return '-'
  const value = phone.trim()
  if (value.length < 7) return value
  return `${value.slice(0, 3)}****${value.slice(-4)}`
}
