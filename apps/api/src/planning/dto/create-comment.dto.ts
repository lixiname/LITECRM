import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsString, IsUUID, MinLength } from 'class-validator'
import { COMMENT_TARGET_TYPES, type CommentTargetType } from '../../common/constants'

// 指导意见（§8.7：author 须为被指导者上级；多态目标）
export class CreateCommentDto {
  @ApiProperty({
    description: '目标类型',
    enum: COMMENT_TARGET_TYPES,
    enumName: 'CommentTargetType',
  })
  @IsIn(COMMENT_TARGET_TYPES)
  targetType!: CommentTargetType

  @ApiProperty({ description: '目标 ID（周计划/计划项/拜访）' })
  @IsUUID()
  targetId!: string

  @ApiProperty({ description: '被指导人 ID' })
  @IsUUID()
  ownerId!: string

  @ApiProperty({ description: '意见内容' })
  @IsString()
  @MinLength(1, { message: '意见内容不能为空' })
  content!: string
}
