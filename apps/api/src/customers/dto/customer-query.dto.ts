import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import {
  CUSTOMER_LEVELS,
  CUSTOMER_STATUSES,
  type CustomerLevel,
  type CustomerStatus,
} from '../../common/constants'

// 客户列表查询（§7.3 检索：keyword 五级排序 + 数据范围过滤 + 分页）
export class CustomerQueryDto {
  @ApiPropertyOptional({ description: '检索词（完全>前缀>包含>城市/别名兜底）' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '城市筛选' })
  @IsOptional()
  @IsString()
  city?: string

  @ApiPropertyOptional({ description: '产业筛选' })
  @IsOptional()
  @IsString()
  industry?: string

  @ApiPropertyOptional({ description: '客户类型筛选' })
  @IsOptional()
  @IsString()
  customerType?: string

  @ApiPropertyOptional({ description: '分级筛选', enum: CUSTOMER_LEVELS })
  @IsOptional()
  @IsIn(CUSTOMER_LEVELS)
  level?: CustomerLevel

  @ApiPropertyOptional({
    description: '状态筛选',
    enum: CUSTOMER_STATUSES,
    enumName: 'CustomerStatus',
  })
  @IsOptional()
  @IsIn(CUSTOMER_STATUSES)
  status?: CustomerStatus

  @ApiPropertyOptional({ description: '页码（从 1 开始）' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ description: '每页条数（默认 20，最大 50）' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number = 20
}
