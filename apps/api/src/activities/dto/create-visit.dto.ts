import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { VISIT_METHODS, type VisitMethod } from '../../common/constants'
import { IsBusinessDate } from '../../common/business-date'

// 拜访登记（§8.4 P0）：必填 customerId/occurredAt/method；visitType 走字典（visit_type）
export class CreateVisitDto {
  @ApiProperty({ description: '客户 ID' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '拜访日期（YYYY-MM-DD）' })
  @IsBusinessDate()
  occurredAt!: string

  @ApiProperty({ description: '拜访方式', enum: VISIT_METHODS, enumName: 'VisitMethod' })
  @IsIn(VISIT_METHODS)
  method!: VisitMethod

  @ApiPropertyOptional({ description: '拜访类型（字典：visit_type）' })
  @IsOptional()
  @IsString()
  visitType?: string

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

  @ApiPropertyOptional({ description: '本次拜访履行的来源计划' })
  @IsOptional()
  @IsUUID()
  sourcePlanId?: string

  @ApiProperty({ description: '下次拜访日期（YYYY-MM-DD）；每次拜访登记均必填' })
  @IsBusinessDate()
  nextActionAt!: string

  @ApiProperty({ description: '下次拜访计划内容；每次拜访登记均必填' })
  @IsString()
  @MinLength(1)
  nextActionContent!: string
}
