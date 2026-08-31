import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator'

/** 管理看板统一筛选；日期按业务发生日，人员按组织树可见范围校验。 */
export class ReportingQueryDto {
  @ApiPropertyOptional({ description: '开始日期（YYYY-MM-DD），默认当月 1 日' })
  @IsOptional()
  @IsDateString()
  start?: string

  @ApiPropertyOptional({ description: '结束日期（YYYY-MM-DD），默认今天' })
  @IsOptional()
  @IsDateString()
  end?: string

  @ApiPropertyOptional({ description: '组织树内人员 ID；不传表示全部可见人员' })
  @IsOptional()
  @IsUUID()
  ownerId?: string

  @ApiPropertyOptional({ description: '人员所属销售大区 ID（只用于统计分组/筛选）' })
  @IsOptional()
  @IsUUID()
  salesRegionId?: string

  @ApiPropertyOptional({ description: '产品线稳定字典值（仅客户/商机类指标）' })
  @IsOptional()
  @IsString()
  productLine?: string
}
