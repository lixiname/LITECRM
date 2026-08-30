import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class ReadAlertDto {
  @ApiProperty({ description: '提醒的稳定业务键' })
  @IsString()
  @MinLength(1)
  key!: string
}
