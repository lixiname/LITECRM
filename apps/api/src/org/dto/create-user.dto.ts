import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { ROLES, type Role } from '../../common/constants'

// 创建用户（admin，user.manage）：密码 ≥8 位，角色限定枚举
export class CreateUserDto {
  @ApiProperty({ description: '登录用户名' })
  @IsString()
  @MinLength(1, { message: '用户名不能为空' })
  username!: string

  @ApiProperty({ description: '初始密码（至少 8 位）' })
  @IsString()
  @MinLength(8, { message: '初始密码至少 8 位' })
  password!: string

  @ApiProperty({ description: '显示名' })
  @IsString()
  @MinLength(1, { message: '显示名不能为空' })
  displayName!: string

  @ApiProperty({ description: '角色', enum: ROLES, enumName: 'Role' })
  @IsIn(ROLES)
  role!: Role

  @ApiPropertyOptional({ description: '直属上级 ID（组织树）' })
  @IsOptional()
  @IsUUID()
  reportsToId?: string

  @ApiPropertyOptional({ description: '手机号（钉钉绑定预留）' })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional({ description: '人员所属销售大区 ID（经营统计维度，不参与权限推导）' })
  @IsOptional()
  @IsUUID()
  salesRegionId?: string
}
