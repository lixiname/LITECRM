import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsString, MinLength } from 'class-validator'

// 结案（§8.5：lost 丢失 / demand_disappeared 需求消失，说明必填）
export class CloseOpportunityDto {
  @ApiProperty({ description: '结案结果', enum: ['lost', 'demand_disappeared'] })
  @IsIn(['lost', 'demand_disappeared'])
  result!: 'lost' | 'demand_disappeared'

  @ApiProperty({ description: '结案说明' })
  @IsString()
  @MinLength(1, { message: '结案说明必填' })
  reason!: string
}
