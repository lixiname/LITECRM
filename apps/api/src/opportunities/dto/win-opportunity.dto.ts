import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsISO8601, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator'

export class WinOpportunityDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number

  @ApiProperty({ description: '客户明确下单时间' })
  @IsISO8601()
  occurredAt!: string

  @ApiProperty({ description: '成交金额' })
  @IsNumber()
  @Min(0)
  amount!: number

  @ApiPropertyOptional({ description: '客户接受的报价' })
  @IsOptional()
  @IsUUID()
  acceptedQuoteId?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  productLine?: string

  @ApiPropertyOptional({ description: '交易性质（字典：trade_type）' })
  @IsOptional()
  @IsString()
  tradeType?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string
}
