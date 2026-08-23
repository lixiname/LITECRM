import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator'

// 每日费用（§8.8：每人每天一条 upsert；五类分项；draft/submitted/voided）
export class CreateExpenseDto {
  @ApiProperty({ description: '费用日期' })
  @IsISO8601()
  expenseDate!: string

  @ApiPropertyOptional({ description: '烟酒' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tobaccoAlcohol?: number

  @ApiPropertyOptional({ description: '礼品' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  gifts?: number

  @ApiPropertyOptional({ description: '餐叙' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  dining?: number

  @ApiPropertyOptional({ description: '招待' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  entertainment?: number

  @ApiPropertyOptional({ description: '住宿' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lodging?: number

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string
}
