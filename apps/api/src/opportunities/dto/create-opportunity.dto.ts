import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator'
import {
  AMOUNT_TYPES,
  OPPORTUNITY_SOURCES,
  type AmountType,
  type OpportunitySource,
} from '../../common/constants'

// 新建商机（§8.5）：意向金额（类型+金额）必填、下一步动作/日期必填
export class CreateOpportunityDto {
  @ApiProperty({ description: '客户 ID' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '需求简述' })
  @IsString()
  @MinLength(1, { message: '需求简述不能为空' })
  name!: string

  @ApiProperty({
    description: '发现渠道',
    enum: OPPORTUNITY_SOURCES,
    enumName: 'OpportunitySource',
  })
  @IsIn(OPPORTUNITY_SOURCES)
  source!: OpportunitySource

  @ApiProperty({ description: '金额类型', enum: AMOUNT_TYPES, enumName: 'AmountType' })
  @IsIn(AMOUNT_TYPES)
  amountType!: AmountType

  @ApiProperty({ description: '意向金额（与成交金额解耦，成交时以报价单金额为准）' })
  @IsNumber()
  amount!: number

  @ApiPropertyOptional({ description: '约估' })
  @IsOptional()
  @IsBoolean()
  approximate?: boolean

  @ApiPropertyOptional({ description: '金额表述' })
  @IsOptional()
  @IsString()
  amountNote?: string

  @ApiPropertyOptional({ description: '大类产品线' })
  @IsOptional()
  @IsString()
  productLine?: string

  @ApiPropertyOptional({ description: '预计成交日' })
  @IsOptional()
  @IsISO8601()
  expectedCloseDate?: string

  @ApiProperty({ description: '下一步动作' })
  @IsString()
  @MinLength(1, { message: '下一步动作必填' })
  nextAction!: string

  @ApiProperty({ description: '下次跟进日期' })
  @IsISO8601()
  nextFollowUpDate!: string
}
