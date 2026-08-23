import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

// 登录：账号密码通道（§8.1；钉钉通道 M6 实现）
export class LoginDto {
  @ApiProperty({ description: '登录用户名' })
  @IsString()
  @MinLength(1, { message: '用户名不能为空' })
  username!: string

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(1, { message: '密码不能为空' })
  password!: string
}
