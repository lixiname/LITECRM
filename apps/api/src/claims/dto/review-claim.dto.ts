import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString } from 'class-validator'

// 审批/拒绝意见（§8.3：拒绝时 comment 必填）
export class ReviewClaimDto {
  @ApiPropertyOptional({ description: '审批意见（拒绝时必填）' })
  @IsOptional()
  @IsString()
  comment?: string
}
