import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  Min,
} from 'class-validator'
import {
  OPPORTUNITY_INITIAL_AMOUNT_BASES,
  type OpportunityInitialAmountBasis,
} from '../../common/constants'
import { IsBusinessDate } from '../../common/business-date'

// 新建商机：金额依据可以是估算或首条报价；商业事实与第一步行动同事务落库。
export class CreateOpportunityDto {
  @ApiProperty({ description: '客户 ID' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '需求简述' })
  @IsString()
  @MinLength(1, { message: '需求简述不能为空' })
  name!: string

  @ApiProperty({ description: '发现渠道（字典：opportunity_source）' })
  @IsString()
  source!: string

  @ApiProperty({
    enum: OPPORTUNITY_INITIAL_AMOUNT_BASES,
    enumName: 'OpportunityInitialAmountBasis',
    description: '初始金额依据：预估、口头报价或正式报价',
  })
  @IsIn(OPPORTUNITY_INITIAL_AMOUNT_BASES)
  initialAmountBasis!: OpportunityInitialAmountBasis

  @ApiProperty({ description: '初始参考金额；报价依据会同时生成首条报价事实' })
  @IsNumber()
  @Min(0)
  initialAmount!: number

  @ApiPropertyOptional({ description: '约估' })
  @IsOptional()
  @IsBoolean()
  approximate?: boolean

  @ApiPropertyOptional({ description: '金额或首条报价说明' })
  @IsOptional()
  @IsString()
  estimateNote?: string

  @ApiPropertyOptional({ description: '需求发现日' })
  @IsOptional()
  @IsBusinessDate()
  discoveredDate?: string

  @ApiPropertyOptional({ description: '产品线，多选', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productLines?: string[]

  @ApiPropertyOptional({ description: '首条报价日期；报价依据时可填，默认今天' })
  @IsOptional()
  @IsBusinessDate()
  initialQuotedAt?: string

  @ApiPropertyOptional({ description: '首张正式报价单号' })
  @IsOptional()
  @IsString()
  initialQuoteNo?: string

  @ApiPropertyOptional({ description: '首张正式报价单文件引用' })
  @IsOptional()
  @IsString()
  initialQuoteDocumentRef?: string

  @ApiPropertyOptional({ description: '预计成交日' })
  @IsOptional()
  @IsBusinessDate()
  expectedCloseDate?: string

  @ApiProperty({ description: '第一步行动内容' })
  @IsString()
  @MinLength(1, { message: '下一步动作必填' })
  firstActionContent!: string

  @ApiProperty({ description: '第一步行动日期（YYYY-MM-DD）' })
  @IsBusinessDate()
  firstActionAt!: string
}
