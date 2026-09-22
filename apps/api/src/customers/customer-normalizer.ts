// 查重键归一化（§7.3：去空格/统一大小写/去「有限公司/集团」等后缀，效果比调阈值大）
// 纯函数，便于单测
export function normalizeBusinessName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[（(]?有限公司[）)]?/g, '')
    .replace(/[（(]?集团[）)]?/g, '')
    .replace(/\s+/g, '')
}

// 电话归一化（§8.2 电话通道：去符号统一比较）
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

// 微信号归一化：保留原值存储，查重时仅忽略首尾空格和大小写。
export function normalizeWechatId(wechatId: string): string {
  return wechatId.trim().toLowerCase()
}
