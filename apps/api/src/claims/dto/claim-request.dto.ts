import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CLAIM_STATUSES, type ClaimStatus } from '../../common/constants'

// 接管申请视图（§8.3 审批列表/详情）：附带客户名与申请人名
export class ClaimRequestDto {
  @ApiProperty({ description: '申请 ID' })
  id!: string

  @ApiProperty({ description: '客户 ID' })
  customerId!: string

  @ApiPropertyOptional({ description: '客户名称（JOIN）' })
  customerName?: string

  @ApiProperty({ description: '申请人 ID' })
  applicantId!: string

  @ApiPropertyOptional({ description: '申请人显示名（JOIN）' })
  applicantName?: string

  @ApiPropertyOptional({ description: '发起时归属快照' })
  currentOwnerId?: string | null

  @ApiProperty({ description: '接管理由' })
  reason!: string

  @ApiProperty({ description: '状态', enum: CLAIM_STATUSES, enumName: 'ClaimStatus' })
  status!: ClaimStatus

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date
}
