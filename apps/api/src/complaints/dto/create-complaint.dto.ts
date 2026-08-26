import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsISO8601, IsString, IsUUID, MinLength } from 'class-validator'

// 登记客诉：问题事实和第一步处理行动同事务写入。
export class CreateComplaintDto {
  @ApiProperty({ description: '客户 ID' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '发生时间' })
  @Type(() => Date)
  @IsDate()
  occurredAt!: Date

  @ApiProperty({ description: '客诉类型（字典：complaint_type）' })
  @IsString()
  type!: string

  @ApiProperty({ description: '问题描述' })
  @IsString()
  @MinLength(1, { message: '问题描述不能为空' })
  description!: string

  @ApiProperty({ description: '第一步处理行动计划时间' })
  @IsISO8601()
  firstActionAt!: string

  @ApiProperty({ description: '第一步处理行动内容' })
  @IsString()
  @MinLength(1)
  firstActionContent!: string
}
