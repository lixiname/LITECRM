import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsIn, IsOptional, IsString, MinLength } from 'class-validator'
import { CUSTOMER_DIMENSIONS, type CustomerDimension } from '../../common/constants'

// 新增字典项（admin，user.manage）：维度限定枚举，name 维度内唯一（§7.2）
export class CreateDimensionOptionDto {
  @ApiProperty({ description: '维度', enum: CUSTOMER_DIMENSIONS, enumName: 'CustomerDimension' })
  @IsIn(CUSTOMER_DIMENSIONS)
  dimension!: CustomerDimension

  @ApiProperty({ description: '选项名称（维度内唯一）' })
  @IsString()
  @MinLength(1, { message: '选项名称不能为空' })
  name!: string

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  sortOrder?: number
}
