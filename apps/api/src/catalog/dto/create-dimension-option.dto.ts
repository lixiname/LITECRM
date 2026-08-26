import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsIn, IsOptional, IsString, MinLength } from 'class-validator'
import { CUSTOMER_DIMENSIONS, type CustomerDimension } from '../../common/constants'

// 新增字典项（admin，user.manage）：name 是稳定值，label 是展示名称
export class CreateDimensionOptionDto {
  @ApiProperty({ description: '维度', enum: CUSTOMER_DIMENSIONS, enumName: 'CustomerDimension' })
  @IsIn(CUSTOMER_DIMENSIONS)
  dimension!: CustomerDimension

  @ApiProperty({ description: '稳定字典值（维度内唯一，如 new_customer）' })
  @IsString()
  @MinLength(1, { message: '选项名称不能为空' })
  name!: string

  @ApiProperty({ description: '展示名称（如新客户开发）' })
  @IsString()
  @MinLength(1, { message: '展示名称不能为空' })
  label!: string

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  sortOrder?: number
}
