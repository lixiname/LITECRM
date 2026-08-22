import { IsString, MinLength } from 'class-validator'

// 本人改密（§8.1：旧密码 bcrypt 校验 + 新密码 ≥8 位 + token_version+1）
export class ChangePasswordDto {
  @IsString()
  @MinLength(1, { message: '旧密码不能为空' })
  oldPassword!: string

  @IsString()
  @MinLength(8, { message: '新密码至少 8 位' })
  newPassword!: string
}
