import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Min } from 'class-validator'

export class ExpenseCommandDto {
  @ApiProperty({ description: '当前费用版本号，用于防止并发覆盖' })
  @IsInt()
  @Min(1)
  version!: number
}
