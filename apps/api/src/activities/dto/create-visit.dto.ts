import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsIn, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator'
import { VISIT_METHODS, type VisitMethod } from '../../common/constants'

// 拜访登记（§8.4 P0）：必填 customerId/occurredAt/method；visitType 走字典（visit_type）
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

  @ApiPropertyOptional({ description: '下一行动计划时间；与行动内容同时填写' })
  @IsOptional()
  @IsISO8601()
  nextActionAt?: string

  @ApiPropertyOptional({ description: '下一行动内容；与计划时间同时填写' })
  @IsOptional()
  @IsString()
  nextActionContent?: string
}
