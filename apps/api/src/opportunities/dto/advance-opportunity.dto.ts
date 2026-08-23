import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsNumber, IsOptional, IsString, Min } from 'class-validator'

// 推进商机（§8.5）：结论 + 下一步；转订单（quoteAmount 非空）→ 幂等生成 Deal，成交金额以 quoteAmount 为准
export class AdvanceOpportunityDto {
  @ApiPropertyOptional({ description: '跟进结论' })
  @IsOptional()
  @IsString()
  conclusion?: string

  @ApiPropertyOptional({ description: '下一步动作' })
  @IsOptional()
  @IsString()
  nextAction?: string

  @ApiPropertyOptional({ description: '下次跟进日期' })
  @IsOptional()
  @IsISO8601()
  nextFollowUpDate?: string

  @ApiPropertyOptional({ description: '报价单金额（填了=转订单，生成 Deal）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  quoteAmount?: number
}
