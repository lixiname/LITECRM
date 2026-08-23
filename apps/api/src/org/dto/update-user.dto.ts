import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID } from 'class-validator'
import { ROLES, type Role } from '../../common/constants'

// 更新用户（admin，user.manage）：字段均可选
export class UpdateUserDto {
  @ApiPropertyOptional({ description: '显示名' })
  @IsOptional()
  @IsString()
  displayName?: string

  @ApiPropertyOptional({ description: '角色', enum: ROLES, enumName: 'Role' })
  @IsOptional()
  @IsIn(ROLES)
  role?: Role

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '直属上级 ID（组织树，null=顶层）',
  })
  @IsOptional()
  @IsUUID()
  reportsToId?: string | null

  @ApiPropertyOptional({ description: '手机号（钉钉绑定预留）' })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional({ description: '区域' })
  @IsOptional()
  @IsString()
  region?: string

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
