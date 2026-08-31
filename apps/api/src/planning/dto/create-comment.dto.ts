import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

// 计划指导留言：目标计划和接收人均由 URL 中的计划 ID 在服务端确定。
export class CreatePlanCommentDto {
  @ApiProperty({ description: '指导留言内容', maxLength: 500 })
  @IsString()
  @MinLength(1, { message: '意见内容不能为空' })
  @MaxLength(500, { message: '意见内容不能超过 500 个字符' })
  content!: string
}
