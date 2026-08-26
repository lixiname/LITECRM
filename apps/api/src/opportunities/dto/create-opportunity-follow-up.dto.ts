import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsISO8601, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator'

export class CreateOpportunityFollowUpDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number

  @ApiProperty({ description: '本次跟进结论' })
  @IsString()
  @MinLength(1)
  conclusion!: string

  @ApiPropertyOptional({ description: '业务发生时间，缺省为当前时间' })
  @IsOptional()
  @IsISO8601()
  occurredAt?: string

  @ApiPropertyOptional({ description: '沟通方式' })
  @IsOptional()
  @IsString()
  method?: string

  @ApiPropertyOptional({ description: '来源拜访记录' })
  @IsOptional()
  @IsUUID()
  sourceVisitId?: string

  @ApiPropertyOptional({ description: '本次完成的旧行动' })
  @IsOptional()
  @IsUUID()
  sourceActionId?: string

  @ApiProperty({ description: '下一行动内容' })
  @IsString()
  @MinLength(1)
  nextActionContent!: string

  @ApiProperty({ description: '下一行动计划时间' })
  @IsISO8601()
  nextActionAt!: string
}
