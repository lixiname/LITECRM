import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator'

// 更新字典项（admin，user.manage）：字段均可选
export class UpdateDimensionOptionDto {
  @ApiPropertyOptional({ description: '选项名称（维度内唯一）' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '选项名称不能为空' })
  name?: string

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  sortOrder?: number

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
