import { ApiProperty } from '@nestjs/swagger'

// 令牌对（/auth/refresh 响应，§6.5 无感刷新：滑动续期）
export class TokenPairDto {
  @ApiProperty({ description: '新的访问令牌（2h）' })
  accessToken!: string

  @ApiProperty({ description: '新的刷新令牌（14d，滑动续期）' })
  refreshToken!: string
}
