import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ROLES, type Role } from '../../common/constants'

// 用户安全输出 DTO（§8.1：剔除 passwordHash / 锁定计数等敏感字段）
export class UserDto {
  @ApiProperty({ description: '用户 ID' })
  id!: string

  @ApiProperty({ description: '登录用户名' })
  username!: string

  @ApiProperty({ description: '显示名' })
  displayName!: string

  @ApiPropertyOptional({ type: String, nullable: true, description: '人员职位' })
  jobTitle!: string | null

  @ApiProperty({ description: '角色', enum: ROLES, enumName: 'Role' })
  role!: Role

  @ApiPropertyOptional({ type: String, nullable: true, description: '手机号（钉钉绑定预留）' })
  phone!: string | null

  @ApiPropertyOptional({ type: String, nullable: true, description: '直属上级 ID（组织树）' })
  reportsToId!: string | null

  @ApiPropertyOptional({ type: String, nullable: true, description: '人员所属销售大区 ID' })
  salesRegionId!: string | null

  @ApiPropertyOptional({ type: String, nullable: true, description: '人员所属销售大区名称' })
  salesRegionName!: string | null

  @ApiProperty({ description: '是否启用' })
  isActive!: boolean

  @ApiProperty({ description: '创建时间' })
  createdAt!: Date

  @ApiProperty({ description: '当前版本号' })
  version!: number
}
