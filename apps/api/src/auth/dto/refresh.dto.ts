import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

// 无感刷新（§6.5：refresh token 换新 access+refresh，滑动续期）
export class RefreshDto {
  @ApiProperty({ description: '刷新令牌' })
  @IsString()
  @MinLength(1, { message: '刷新令牌不能为空' })
  refreshToken!: string
}
