import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUUID, MinLength } from 'class-validator'

// 所有权转移（§8.3）：owner/管理链/admin 发起，分级名额校验，同事务写 customer_transfers
export class TransferCustomerDto {
  @ApiProperty({ description: '新负责人 ID（需校验对应客户等级名额）' })
  @IsUUID()
  toOwnerId!: string

  @ApiProperty({ description: '移交原因（审计）' })
  @IsString()
  @MinLength(1, { message: '移交原因不能为空' })
  reason!: string
}
