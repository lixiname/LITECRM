import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ROLES, type Role } from '../../common/constants'

// 登录响应当前用户（轻量快照，§8.1）
export class AuthUserDto {
  @ApiProperty({ description: '用户 ID' })
  id!: string

  @ApiProperty({ description: '登录用户名' })
  username!: string

  @ApiProperty({ description: '显示名' })
  displayName!: string

  @ApiPropertyOptional({ type: String, nullable: true, description: '人员职位（界面身份回显）' })
  jobTitle!: string | null

  @ApiProperty({ description: '角色', enum: ROLES, enumName: 'Role' })
  role!: Role
}
