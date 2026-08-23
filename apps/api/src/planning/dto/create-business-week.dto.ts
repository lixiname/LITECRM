import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsISO8601, IsOptional, IsString, MinLength } from 'class-validator'

// 创建业务周（§8.7：admin 配置，weekStart 唯一）
export class CreateBusinessWeekDto {
  @ApiProperty({ description: '业务周名称' })
  @IsString()
  @MinLength(1, { message: '名称不能为空' })
  name!: string

  @ApiProperty({ description: '周起始日' })
  @IsISO8601()
  weekStart!: string

  @ApiProperty({ description: '周结束日' })
  @IsISO8601()
  weekEnd!: string

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
