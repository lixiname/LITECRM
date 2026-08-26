import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsISO8601, IsString, Min, MinLength } from 'class-validator'

export class CompleteFollowUpActionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number
}

export class RescheduleFollowUpActionDto extends CompleteFollowUpActionDto {
  @ApiProperty({ description: '新的计划执行时间' })
  @IsISO8601()
  plannedAt!: string
}

export class CancelFollowUpActionDto extends CompleteFollowUpActionDto {
  @ApiProperty({ description: '取消原因' })
  @IsString()
  @MinLength(1)
  reason!: string
}
