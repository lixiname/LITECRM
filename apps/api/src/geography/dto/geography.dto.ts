import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AdministrativeDivisionDto {
  @ApiProperty({ example: '320000' })
  code!: string

  @ApiProperty({ example: '江苏省' })
  name!: string

  @ApiProperty({ enum: ['province', 'city'] })
  level!: 'province' | 'city'

  @ApiPropertyOptional({ type: String, nullable: true, example: '320000' })
  parentCode!: string | null
}

export class SalesRegionDto {
  @ApiProperty()
  id!: string

  @ApiProperty({ example: 'jiangsu' })
  code!: string

  @ApiProperty({ example: '江苏' })
  name!: string
}
