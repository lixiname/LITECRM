import { ApiProperty } from '@nestjs/swagger'
import { ABILITIES, DATA_SCOPES, type Ability, type DataScope } from '../../common/constants'
import { AuthUserDto } from './auth-user.dto'

// 登录成功响应（§8.1：user + 双 token + 权限快照）
export class LoginResponseDto {
  @ApiProperty({ type: AuthUserDto, description: '当前用户' })
  user!: AuthUserDto

  @ApiProperty({ description: '访问令牌（2h）' })
  accessToken!: string

  @ApiProperty({ description: '刷新令牌（14d，滑动续期）' })
  refreshToken!: string

  @ApiProperty({ isArray: true, enum: ABILITIES, enumName: 'Ability', description: '能力点快照' })
  capabilities!: Ability[]

  @ApiProperty({ enum: DATA_SCOPES, enumName: 'DataScope', description: '数据范围快照' })
  dataScope!: DataScope
}
