import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsString, MinLength } from 'class-validator'

// 主动释放（§8.3）：owner 本人发起；target=pool 公海 / invalid 无效；未解决客诉拦截（M3 接入）
export class ReleaseCustomerDto {
  @ApiProperty({
    description: '去向：pool=公海（他人可认领）/ invalid=无效（记录保留）',
    enum: ['pool', 'invalid'],
  })
  @IsIn(['pool', 'invalid'])
  target!: 'pool' | 'invalid'

  @ApiProperty({ description: '释放原因（审计）' })
  @IsString()
  @MinLength(1, { message: '释放原因不能为空' })
  reason!: string
}
