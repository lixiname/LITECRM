import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

// 接管申请（§8.3）：非 admin/assistant、非当前 owner、无 pending
export class CreateClaimDto {
  @ApiProperty({ description: '接管理由' })
  @IsString()
  @MinLength(1, { message: '接管理由不能为空' })
  reason!: string
}
