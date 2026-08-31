import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator'
import { ROLES, type Role } from '../../common/constants'

// 更新用户（admin，user.manage）：字段均可选
export class UpdateUserDto {
  @ApiProperty({ description: '用户当前版本号，用于防止并发覆盖' })
  @IsInt()
  @Min(1)
  version!: number

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

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: '人员所属销售大区 ID（null=未分配）',
  })
  @IsOptional()
  @IsUUID()
  salesRegionId?: string | null

  @ApiPropertyOptional({ description: '是否启用' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean
}
