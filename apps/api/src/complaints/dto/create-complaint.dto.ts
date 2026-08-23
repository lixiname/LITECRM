import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsDate, IsIn, IsISO8601, IsString, IsUUID, MinLength } from 'class-validator'
import { COMPLAINT_TYPES, type ComplaintType } from '../../common/constants'

// 登记客诉（§8.6）：description 必填、nextFollowUpDate 必填、触发客户风险告警（M5）
export class CreateComplaintDto {
  @ApiProperty({ description: '客户 ID' })
  @IsUUID()
  customerId!: string

  @ApiProperty({ description: '发生时间' })
  @Type(() => Date)
  @IsDate()
  occurredAt!: Date

  @ApiProperty({ description: '客诉类型', enum: COMPLAINT_TYPES, enumName: 'ComplaintType' })
  @IsIn(COMPLAINT_TYPES)
  type!: ComplaintType

  @ApiProperty({ description: '问题描述' })
  @IsString()
  @MinLength(1, { message: '问题描述不能为空' })
  description!: string

  @ApiProperty({ description: '下次确认日期' })
  @IsISO8601()
  nextFollowUpDate!: string
}
