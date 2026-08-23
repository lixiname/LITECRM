import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'

// 周计划项（§8.7：plannedDate 在业务周内；customerId 可空；action 必填）
export class CreatePlanItemDto {
  @ApiProperty({ description: '计划日期' })
  @IsISO8601()
  plannedDate!: string

  @ApiPropertyOptional({ description: '关联客户（可空=同行关系维护）' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiProperty({ description: '行动计划' })
  @IsString()
  @MinLength(1, { message: '行动计划必填' })
  action!: string

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string
}
