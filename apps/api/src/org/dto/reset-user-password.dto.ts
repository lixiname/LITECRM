import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class ResetUserPasswordDto {
  @ApiProperty({ description: '管理员为用户设置的新密码', minLength: 8, maxLength: 128 })
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string
}
