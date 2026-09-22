import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator'

// 联系人（§7.2：name 可空；电话或微信号至少填写一项，由应用层校验）
export class CreateContactDto {
  @ApiPropertyOptional({ description: '姓名（可空=仅留联系方式）' })
  @IsOptional()
  @IsString()
  name?: string

  @ApiPropertyOptional({ description: '职位' })
  @IsOptional()
  @IsString()
  title?: string

  @ApiPropertyOptional({ description: '岗位类别（字典：contact_function）' })
  @IsOptional()
  @IsString()
  functionRole?: string

  @ApiPropertyOptional({ description: '电话（与微信号至少填写一项）' })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional({ description: '微信号（可搜索账号，不使用微信昵称）' })
  @IsOptional()
  @IsString()
  wechatId?: string

  @ApiPropertyOptional({ description: '是否首要联系人（每客户至多一个）' })
  @IsOptional()
  @IsBoolean()
  isKeyContact?: boolean
}

export class UpdateContactDto extends CreateContactDto {
  @ApiProperty({ description: '联系人当前版本号，用于防止并发覆盖' })
  @IsInt()
  @Min(1)
  version!: number
}
