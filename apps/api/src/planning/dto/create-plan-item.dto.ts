import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { SALES_PLAN_KINDS, type SalesPlanKind } from '../../common/constants'

// 周计划项（§8.7：plannedDate 在业务周内；customerId 可空；action 必填）
export class CreatePlanItemDto {
  @ApiProperty({ description: '计划执行时间' })
  @IsISO8601()
  plannedAt!: string

  @ApiProperty({ description: '业务计划类型', enum: SALES_PLAN_KINDS, enumName: 'SalesPlanKind' })
  @IsIn(SALES_PLAN_KINDS)
  planKind!: SalesPlanKind

  @ApiProperty({ description: '关联客户' })
  @IsUUID()
  customerId!: string

  @ApiPropertyOptional({ description: '关联商机' })
  @IsOptional()
  @IsUUID()
  opportunityId?: string

  @ApiProperty({ description: '行动计划' })
  @IsString()
  @MinLength(1, { message: '行动计划必填' })
  content!: string

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string
}
