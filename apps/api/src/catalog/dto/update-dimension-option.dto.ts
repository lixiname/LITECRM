import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'

// 更新字典项（admin，user.manage）：字段均可选
export class UpdateDimensionOptionDto {
  @ApiProperty({ description: '字典项当前版本号，用于防止并发覆盖' })
  @IsInt()
  @Min(1)
  version!: number

  @ApiPropertyOptional({ description: '展示名称' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '展示名称不能为空' })
  label?: string

  @ApiPropertyOptional({ description: '排序权重' })
  @IsOptional()
  @IsInt()
  sortOrder?: number

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
