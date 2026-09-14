import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Min } from 'class-validator'

export class UnlockUserLoginDto {
  @ApiProperty({ description: '用户当前版本号，用于防止并发覆盖' })
  @IsInt()
  @Min(1)
  version!: number
}
