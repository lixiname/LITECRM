import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { SALES_PLAN_KINDS, type SalesPlanKind } from '../../common/constants'

export class CreateSalesPlanDto {
  @ApiProperty({ description: '业务计划类型', enum: SALES_PLAN_KINDS, enumName: 'SalesPlanKind' })
  @IsIn(SALES_PLAN_KINDS)
  planKind!: SalesPlanKind

  @ApiProperty({ description: '计划执行时间' })
  @IsISO8601()
  plannedAt!: string

  @ApiProperty({ description: '计划内容' })
  @IsString()
  @MinLength(1)
  content!: string

  @ApiProperty({ description: '关联客户' })
  @IsUUID()
  customerId!: string

  @ApiPropertyOptional({ description: '商机跟进计划关联的商机' })
  @IsOptional()
  @IsUUID()
  opportunityId?: string

  @ApiPropertyOptional({ description: '客诉处理计划关联的客诉' })
  @IsOptional()
  @IsUUID()
  complaintId?: string
}
