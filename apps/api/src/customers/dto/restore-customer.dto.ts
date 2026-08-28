import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUUID, MinLength } from 'class-validator'

/** 无效档案恢复：必须重新指定负责人并记录原因。 */
export class RestoreCustomerDto {
  @ApiProperty({ description: '恢复后的负责人 ID' })
  @IsUUID()
  toOwnerId!: string

  @ApiProperty({ description: '恢复原因' })
  @IsString()
  @MinLength(1)
  reason!: string
}
