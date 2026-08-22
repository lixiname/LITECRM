import { IsIn, IsOptional, IsString, IsUUID, MinLength } from 'class-validator'
import { ROLES, type Role } from '../../common/constants'

// 创建用户（admin，user.manage）：密码 ≥8 位，角色限定枚举
export class CreateUserDto {
  @IsString()
  @MinLength(1, { message: '用户名不能为空' })
  username!: string

  @IsString()
  @MinLength(8, { message: '初始密码至少 8 位' })
  password!: string

  @IsString()
  @MinLength(1, { message: '显示名不能为空' })
  displayName!: string

  @IsIn(ROLES)
  role!: Role

  @IsOptional()
  @IsUUID()
  reportsToId?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  region?: string
}
