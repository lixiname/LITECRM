import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
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
  ValidateNested,
} from 'class-validator'
import { OPPORTUNITY_QUOTE_KINDS, type OpportunityQuoteKind } from '../../common/constants'

export class OpportunityProgressQuoteDto {
  @ApiProperty({ enum: OPPORTUNITY_QUOTE_KINDS, enumName: 'OpportunityQuoteKind' })
  @IsIn(OPPORTUNITY_QUOTE_KINDS)
  kind!: OpportunityQuoteKind

  @ApiPropertyOptional({ description: '报价时间；缺省时与本次推进时间一致' })
  @IsOptional()
  @IsISO8601()
  quotedAt?: string

  @ApiProperty({ description: '报价总额' })
  @IsNumber()
  @Min(0)
  amount!: number

  @ApiPropertyOptional({ description: '正式报价单号' })
  @IsOptional()
  @IsString()
  quoteNo?: string

  @ApiPropertyOptional({ description: '报价说明' })
  @IsOptional()
  @IsString()
  note?: string

  @ApiPropertyOptional({ description: '可选文件引用；不要求上传' })
  @IsOptional()
  @IsString()
  documentRef?: string
}

export class CreateOpportunityFollowUpDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number

  @ApiProperty({ description: '本次跟进结论' })
  @IsString()
  @MinLength(1)
  conclusion!: string

  @ApiPropertyOptional({ description: '业务发生时间，缺省为当前时间' })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string

  @ApiPropertyOptional({ description: '沟通方式' })
  @IsOptional()
  @IsString()
  method?: string

  @ApiPropertyOptional({ description: '本次跟进履行的来源计划' })
  @IsOptional()
  @IsUUID()
  sourcePlanId?: string

  @ApiPropertyOptional({ description: '本次推进中产生的新报价' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OpportunityProgressQuoteDto)
  quote?: OpportunityProgressQuoteDto

  @ApiProperty({ description: '下一行动内容；开放商机的每次跟进均必填' })
  @IsString()
  @MinLength(1)
  nextActionContent!: string

  @ApiProperty({ description: '下一行动计划时间；开放商机的每次跟进均必填' })
  @IsISO8601()
  nextActionAt!: string
}
