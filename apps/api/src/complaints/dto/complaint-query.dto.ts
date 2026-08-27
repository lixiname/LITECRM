import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator'
import { COMPLAINT_STATUSES, type ComplaintStatus } from '../../common/constants'

function optionalBoolean(value: unknown): unknown {
  if (value === undefined || value === '') return undefined
  if (value === 'true' || value === true) return true
  if (value === 'false' || value === false) return false
  return value
}

/** 客诉工作台查询：摘要筛选与服务端页码分页。 */
export class ComplaintQueryDto {
  @ApiPropertyOptional({ description: '检索客诉描述或客户名称' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '限定客户 ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional({ description: '处理状态', enum: COMPLAINT_STATUSES })
  @IsOptional()
  @IsIn(COMPLAINT_STATUSES)
  status?: ComplaintStatus

  @ApiPropertyOptional({ description: '是否只看已逾期待办' })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  overdue?: boolean

  @ApiPropertyOptional({ description: '页码（从 1 开始）' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1

  @ApiPropertyOptional({ description: '每页条数（默认 20，最大 100）' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20
}
