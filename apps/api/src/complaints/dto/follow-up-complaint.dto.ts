import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator'
import {
  COMPLAINT_STATUSES,
  FOLLOW_UP_OUTCOMES,
  type ComplaintStatus,
  type FollowUpOutcome,
} from '../../common/constants'
import { IsBusinessDate } from '../../common/business-date'

// 客诉跟进（§8.6）：content 必填；FOLLOWED_UP → 必填下次确认日；RESOLVED → 必填解决结果
export class FollowUpComplaintDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number

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

  @ApiPropertyOptional({ description: '本次处理履行的来源计划' })
  @IsOptional()
  @IsUUID()
  sourcePlanId?: string

  @ApiPropertyOptional({ description: '下一处理行动日期（YYYY-MM-DD，followed_up 必填）' })
  @IsOptional()
  @IsBusinessDate()
  nextActionAt?: string

  @ApiPropertyOptional({ description: '下一处理行动内容（followed_up 必填）' })
  @IsOptional()
  @IsString()
  nextActionContent?: string

  // 响应类型声明（Swagger 生成枚举；请求端不传）
  @ApiPropertyOptional({
    description: '客诉状态（类型声明）',
    enum: COMPLAINT_STATUSES,
    enumName: 'ComplaintStatus',
  })
  status?: ComplaintStatus
}
