import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  Min,
} from 'class-validator'

// 新建商机：意向规模与第一步行动必填；意向规模不是报价。
export class CreateOpportunityDto {
  @ApiProperty({ description: '客户 ID' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '需求简述' })
  @IsString()
  @MinLength(1, { message: '需求简述不能为空' })
  name!: string

  @ApiProperty({ description: '发现渠道（字典：opportunity_source）' })
  @IsString()
  source!: string

  @ApiProperty({ description: '意向规模估计（不生成报价）' })
  @IsNumber()
  @Min(0)
  estimatedAmount!: number

  @ApiPropertyOptional({ description: '约估' })
  @IsOptional()
  @IsBoolean()
  approximate?: boolean

  @ApiPropertyOptional({ description: '金额表述' })
  @IsOptional()
  @IsString()
  estimateNote?: string

  @ApiPropertyOptional({ description: '需求发现日' })
  @IsOptional()
  @IsISO8601()
  discoveredDate?: string

  @ApiPropertyOptional({ description: '大类产品线' })
  @IsOptional()
  @IsString()
  productLine?: string

  @ApiPropertyOptional({ description: '预计成交日' })
  @IsOptional()
  @IsISO8601()
  expectedCloseDate?: string

  @ApiProperty({ description: '第一步行动内容' })
  @IsString()
  @MinLength(1, { message: '下一步动作必填' })
  firstActionContent!: string

  @ApiProperty({ description: '第一步行动计划时间' })
  @IsISO8601()
  firstActionAt!: string
}
