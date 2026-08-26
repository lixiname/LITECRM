import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

export class CreateFollowUpActionDto {
  @ApiProperty({ description: '计划执行时间' })
  @IsISO8601()
  plannedAt!: string

  @ApiProperty({ description: '行动内容' })
  @IsString()
  @MinLength(1)
  content!: string

  @ApiPropertyOptional({ description: '关联客户' })
  @IsOptional()
  @IsUUID()
  customerId?: string
}
