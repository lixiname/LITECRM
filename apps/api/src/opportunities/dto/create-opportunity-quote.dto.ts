import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator'
import { OPPORTUNITY_QUOTE_KINDS, type OpportunityQuoteKind } from '../../common/constants'
import { IsBusinessDate } from '../../common/business-date'

export class CreateOpportunityQuoteDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number

  @ApiProperty({ enum: OPPORTUNITY_QUOTE_KINDS, enumName: 'OpportunityQuoteKind' })
  @IsIn(OPPORTUNITY_QUOTE_KINDS)
  kind!: OpportunityQuoteKind

  @ApiProperty({ description: '报价日期（YYYY-MM-DD）' })
  @IsBusinessDate()
  quotedAt!: string

  @ApiProperty({ description: '报价总额' })
  @IsNumber()
  @Min(0)
  amount!: number

  @ApiPropertyOptional({ description: '正式报价单号' })
  @IsOptional()
  @IsString()
  quoteNo?: string

  @ApiPropertyOptional({ description: '本次报价履行的来源计划' })
  @IsOptional()
  @IsUUID()
  sourcePlanId?: string

  @ApiProperty({ description: '报价后的下一行动内容；开放商机的每次报价均必填' })
  @IsString()
  @MinLength(1)
  nextActionContent!: string

  @ApiProperty({ description: '报价后的下一行动日期（YYYY-MM-DD）；开放商机的每次报价均必填' })
  @IsBusinessDate()
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
