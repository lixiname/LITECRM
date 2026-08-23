import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsIn, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator'
import {
  VISIT_METHODS,
  VISIT_TYPES,
  type VisitMethod,
  type VisitType,
} from '../../common/constants'

// 拜访登记（§8.4 P0）：必填 customerId/occurredAt/method；填 nextFollowUpDate → 强一致生成周计划项（M4）
export class CreateVisitDto {
  @ApiProperty({ description: '客户 ID' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '沟通时间（业务时间）' })
  @Type(() => Date)
  @IsDate()
  occurredAt!: Date

  @ApiProperty({ description: '拜访方式', enum: VISIT_METHODS, enumName: 'VisitMethod' })
  @IsIn(VISIT_METHODS)
  method!: VisitMethod

  @ApiPropertyOptional({ description: '拜访类型', enum: VISIT_TYPES, enumName: 'VisitType' })
  @IsOptional()
  @IsIn(VISIT_TYPES)
  visitType?: VisitType

  @ApiPropertyOptional({ description: '生意情况' })
  @IsOptional()
  @IsString()
  businessSituation?: string

  @ApiPropertyOptional({ description: '设备使用' })
  @IsOptional()
  @IsString()
  equipmentSituation?: string

  @ApiPropertyOptional({ description: '人员变动' })
  @IsOptional()
  @IsString()
  personnelChanges?: string

  @ApiPropertyOptional({ description: '下次拜访日期（触发周计划生成）' })
  @IsOptional()
  @IsISO8601()
  nextFollowUpDate?: string

  @ApiPropertyOptional({ description: '下次拜访动作' })
  @IsOptional()
  @IsString()
  nextFollowUpAction?: string
}
