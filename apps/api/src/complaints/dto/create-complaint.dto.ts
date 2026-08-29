import { ApiProperty } from '@nestjs/swagger'
import { IsString, IsUUID, MinLength } from 'class-validator'
import { IsBusinessDate } from '../../common/business-date'

// 登记客诉：问题事实和第一步处理行动同事务写入。
export class CreateComplaintDto {
  @ApiProperty({ description: '客户 ID' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '发生日期（YYYY-MM-DD）' })
  @IsBusinessDate()
  occurredAt!: string

  @ApiProperty({ description: '客诉类型（字典：complaint_type）' })
  @IsString()
  type!: string

  @ApiProperty({ description: '问题描述' })
  @IsString()
  @MinLength(1, { message: '问题描述不能为空' })
  description!: string

  @ApiProperty({ description: '第一步处理行动日期（YYYY-MM-DD）' })
  @IsBusinessDate()
  firstActionAt!: string

  @ApiProperty({ description: '第一步处理行动内容' })
  @IsString()
  @MinLength(1)
  firstActionContent!: string
}
