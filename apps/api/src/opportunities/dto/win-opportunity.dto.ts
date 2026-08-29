import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import { IsBusinessDate } from '../../common/business-date'

export class WinOpportunityDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number

  @ApiProperty({ description: '客户明确下单日期（YYYY-MM-DD）' })
  @IsBusinessDate()
  occurredAt!: string

  @ApiProperty({ description: '成交金额' })
  @IsNumber()
  @Min(0)
  amount!: number

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
