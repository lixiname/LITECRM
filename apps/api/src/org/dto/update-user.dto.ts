import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator'
import { ROLES, type Role } from '../../common/constants'

// 更新用户（admin，user.manage）：字段均可选
export class UpdateUserDto {
  @IsOptional()
  @IsString()
  displayName?: string

  @IsOptional()
  @IsIn(ROLES)
  role?: Role

  @IsOptional()
  @IsUUID()
  reportsToId?: string | null

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  region?: string

  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
