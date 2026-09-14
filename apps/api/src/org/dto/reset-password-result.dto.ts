import { ApiProperty } from '@nestjs/swagger'

/** 管理员重置密码结果：临时密码仅在本次响应中返回。 */
export class ResetPasswordResultDto {
  @ApiProperty({ description: '临时密码（仅此一次展示）' })
  temporaryPassword!: string
}
