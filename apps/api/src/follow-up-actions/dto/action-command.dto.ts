import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsISO8601, IsString, MaxLength, Min, MinLength } from 'class-validator'

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

  @ApiProperty({ description: '改期原因', maxLength: 150 })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  reason!: string
}
