import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsOptional, IsString } from 'class-validator'

// 联系人（§7.2：name 可空=裸电话场景；每客户至多一个首要联系人）
export class CreateContactDto {
  @ApiPropertyOptional({ description: '姓名（可空=裸电话）' })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ description: '职位' })
  @IsOptional()
  @IsString()
  title?: string

  @ApiPropertyOptional({ description: '电话（每个客户至少一个联系人含电话）' })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional({ description: '是否首要联系人（每客户至多一个）' })
  @IsOptional()
  @IsBoolean()
  isKeyContact?: boolean
}
