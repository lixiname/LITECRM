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

export class CancelSalesPlanDto extends SalesPlanVersionDto {
  @ApiProperty({ description: '取消原因' })
  @IsString()
  @MinLength(1)
  reason!: string
}
