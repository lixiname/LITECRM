import { BadRequestException } from '@nestjs/common'
import { validate } from 'class-validator'
import { describe, expect, it } from 'vitest'
import { UpdateVisitEntryRulesDto } from './dto/visit-entry-rules.dto'
import { assertVisitEntryText } from './visit-entry-rules.service'

describe('拜访填报字数规则', () => {
  it('默认下限 0 不额外限制本次情况，但下次拜访仍必填', () => {
    const rules = { businessSituationMinLength: 0, nextActionContentMinLength: 0 }
    expect(() => assertVisitEntryText(rules, undefined, '下次再访')).not.toThrow()
    expect(() => assertVisitEntryText(rules, '', '  ')).toThrow(BadRequestException)
  })

  it('对新提交的两个字段分别校验去除首尾空白后的 Unicode 字符数', () => {
    const rules = { businessSituationMinLength: 4, nextActionContentMinLength: 5 }
    expect(() => assertVisitEntryText(rules, ' 生产线 ', '下周确认预算')).toThrow(
      '本次情况至少填写 4 字',
    )
    expect(() => assertVisitEntryText(rules, ' 生产线扩建 ', '  下周去  ')).toThrow(
      '下次拜访内容至少填写 5 字',
    )
    expect(() => assertVisitEntryText(rules, ' 生产线扩建 ', ' 下周确认预算 ')).not.toThrow()
  })

  it('管理员配置只接受 0 到 1000 的整数', async () => {
    const valid = Object.assign(new UpdateVisitEntryRulesDto(), {
      businessSituationMinLength: 0,
      nextActionContentMinLength: 50,
    })
    expect(await validate(valid)).toHaveLength(0)

    const invalid = Object.assign(new UpdateVisitEntryRulesDto(), {
      businessSituationMinLength: -1,
      nextActionContentMinLength: 1001.5,
    })
    expect(await validate(invalid)).toHaveLength(2)
  })
})
