import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator'
import {
  OPPORTUNITY_STAGES,
  TRADE_TYPES,
  type OpportunityStage,
  type TradeType,
} from '../../common/constants'

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

  // 以下为响应类型声明（Swagger 生成枚举；请求端不传，由服务端写入）
  @ApiPropertyOptional({
    description: '推进后阶段（类型声明）',
    enum: OPPORTUNITY_STAGES,
    enumName: 'OpportunityStage',
  })
  stage?: OpportunityStage

  @ApiPropertyOptional({
    description: '成交交易性质（类型声明）',
    enum: TRADE_TYPES,
    enumName: 'TradeType',
  })
  tradeType?: TradeType
}
