import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsISO8601, IsString, Min, MinLength } from 'class-validator'

export class SalesPlanVersionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number
}

export class RescheduleSalesPlanDto extends SalesPlanVersionDto {
  @ApiProperty({ description: '新的计划执行时间' })
  @IsISO8601()
  plannedAt!: string
}

export class ReplaceSalesPlanDto extends SalesPlanVersionDto {
  @ApiProperty({ description: '替代计划的执行时间' })
  @IsISO8601()
  plannedAt!: string

  @ApiProperty({ description: '替代计划的内容' })
  @IsString()
  @MinLength(1)
  content!: string

  @ApiProperty({ description: '替换原因' })
  @IsString()
  @MinLength(1)
  reason!: string
}
