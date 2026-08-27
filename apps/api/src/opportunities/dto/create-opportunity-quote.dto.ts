import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator'
import { OPPORTUNITY_QUOTE_KINDS, type OpportunityQuoteKind } from '../../common/constants'

export class CreateOpportunityQuoteDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number

  @ApiProperty({ enum: OPPORTUNITY_QUOTE_KINDS, enumName: 'OpportunityQuoteKind' })
  @IsIn(OPPORTUNITY_QUOTE_KINDS)
  kind!: OpportunityQuoteKind

  @ApiProperty({ description: '报价时间' })
  @IsISO8601()
  quotedAt!: string

  @ApiProperty({ description: '报价总额' })
  @IsNumber()
  @Min(0)
  amount!: number

  @ApiPropertyOptional({ description: '正式报价单号' })
  @IsOptional()
  @IsString()
  quoteNo?: string

  @ApiPropertyOptional({ description: '明确替代的旧报价' })
  @IsOptional()
  @IsUUID()
  supersedesQuoteId?: string

  @ApiPropertyOptional({ description: '本次报价履行的来源计划' })
  @IsOptional()
  @IsUUID()
  sourcePlanId?: string

  @ApiProperty({ description: '报价后的下一行动内容' })
  @IsString()
  @MinLength(1)
  nextActionContent!: string

  @ApiProperty({ description: '报价后的下一行动计划时间' })
  @IsISO8601()
  nextActionAt!: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string

  @ApiPropertyOptional({ description: '可选文件引用；不要求上传' })
  @IsOptional()
  @IsString()
  documentRef?: string
}
