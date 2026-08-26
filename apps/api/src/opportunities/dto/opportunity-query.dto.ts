import { ApiPropertyOptional } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator'
import { OPPORTUNITY_STAGES, type OpportunityStage } from '../../common/constants'

function optionalBoolean(value: unknown): unknown {
  if (value === undefined || value === '') return undefined
  if (value === 'true' || value === true) return true
  if (value === 'false' || value === false) return false
  return value
}

/** 商机工作台查询：检索、业务筛选与服务端分页。 */
export class OpportunityQueryDto {
  @ApiPropertyOptional({ description: '检索商机名称或客户名称' })
  @IsOptional()
  @IsString()
  keyword?: string

  @ApiPropertyOptional({ description: '限定客户 ID' })
  @IsOptional()
  @IsUUID()
  customerId?: string

  @ApiPropertyOptional({ description: '商机阶段', enum: OPPORTUNITY_STAGES })
  @IsOptional()
  @IsIn(OPPORTUNITY_STAGES)
  stage?: OpportunityStage

  @ApiPropertyOptional({ description: '最低意向金额' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  minAmount?: number

  @ApiPropertyOptional({ description: '最高意向金额' })
  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsNumber()
  @Min(0)
  maxAmount?: number

  @ApiPropertyOptional({ description: '是否已有报价' })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  hasQuote?: boolean

  @ApiPropertyOptional({ description: '是否缺少下一步行动' })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  noNextAction?: boolean

  @ApiPropertyOptional({ description: '是否存在停滞风险' })
  @IsOptional()
  @Transform(({ value }) => optionalBoolean(value))
  @IsBoolean()
  stagnant?: boolean

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
