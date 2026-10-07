import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Max, Min } from 'class-validator'

export class VisitEntryRulesDto {
  @ApiProperty({ description: '本次情况最少字数；0 表示不限制', minimum: 0, maximum: 1000 })
  businessSituationMinLength!: number

  @ApiProperty({
    description: '下次拜访内容的额外最少字数；0 表示不附加限制，但内容仍必填',
    minimum: 0,
    maximum: 1000,
  })
  nextActionContentMinLength!: number
}

export class UpdateVisitEntryRulesDto extends VisitEntryRulesDto {
  @IsInt()
  @Min(0)
  @Max(1000)
  declare businessSituationMinLength: number

  @IsInt()
  @Min(0)
  @Max(1000)
  declare nextActionContentMinLength: number
}
