import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsBoolean,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator'

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

  @ApiPropertyOptional({ description: '本次跟进履行的来源计划' })
  @IsOptional()
  @IsUUID()
  sourcePlanId?: string

  @ApiPropertyOptional({ description: '临时记录时保留当前未完成计划，不另建下一计划' })
  @IsOptional()
  @IsBoolean()
  keepExistingPlan?: boolean

  @ApiPropertyOptional({ description: '下一行动内容；不保留现有计划时必填' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  nextActionContent?: string

  @ApiPropertyOptional({ description: '下一行动计划时间；不保留现有计划时必填' })
  @IsOptional()
  @IsISO8601()
  nextActionAt?: string
}
