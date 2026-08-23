import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsISO8601, IsIn, IsOptional, IsString, MinLength } from 'class-validator'
import { FOLLOW_UP_OUTCOMES, type FollowUpOutcome } from '../../common/constants'

// 客诉跟进（§8.6）：content 必填；FOLLOWED_UP → 必填下次确认日；RESOLVED → 必填解决结果
export class FollowUpComplaintDto {
  @ApiProperty({ description: '本次处理确认' })
  @IsString()
  @MinLength(1, { message: '处理确认不能为空' })
  content!: string

  @ApiProperty({ description: '跟进结果', enum: FOLLOW_UP_OUTCOMES, enumName: 'FollowUpOutcome' })
  @IsIn(FOLLOW_UP_OUTCOMES)
  outcome!: FollowUpOutcome

  @ApiPropertyOptional({ description: '解决结果（outcome=resolved 必填）' })
  @IsOptional()
  @IsString()
  resolution?: string

  @ApiPropertyOptional({ description: '下次确认日期（outcome=followed_up 必填）' })
  @IsOptional()
  @IsISO8601()
  nextFollowUpDate?: string
}
