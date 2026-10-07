import { BadRequestException } from '@nestjs/common'

/** 标准字典代码与“其他”原文分列，避免自由文本污染分类维度。 */
export function resolveCustomerDimensionOther(
  label: string,
  code: string | null | undefined,
  otherText: string | null | undefined,
): string | null {
  const text = otherText?.trim() || null
  if (code === 'other') {
    if (!text) throw new BadRequestException(`选择其他${label}时，请填写具体内容`)
    if (text.length > 80) throw new BadRequestException(`其他${label}不能超过80字`)
    return text
  }
  if (text) throw new BadRequestException(`只有选择其他${label}时才能填写具体内容`)
  return null
}
