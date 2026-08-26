import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { ROLES, type Role } from '../../common/constants'

export class AssigneeOptionDto {
  @ApiProperty({ description: '可接收客户的用户 ID' })
  id!: string

  @ApiProperty({ description: '显示名' })
  displayName!: string

  @ApiProperty({ enum: ROLES, enumName: 'Role', description: '角色' })
  role!: Role

  @ApiPropertyOptional({ type: String, nullable: true, description: '所属区域' })
  region!: string | null
}
