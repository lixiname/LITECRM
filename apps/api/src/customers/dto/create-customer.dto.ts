import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
  ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'
import { CUSTOMER_GRADES, type CustomerGrade } from '../../common/constants'
import { CreateContactDto } from './contact.dto'

// 创建客户（§8.2/8.3）：name 必填 + 至少一个联系人电话（应用层校验）；ownerId 缺省=建档人
export class CreateCustomerDto {
  @ApiProperty({ description: '客户名称（可地址式）' })
  @IsString()
  @MinLength(1, { message: '客户名称不能为空' })
  name!: string

  @ApiPropertyOptional({ type: [String], description: '别名/简称' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliasNames?: string[]

  @ApiPropertyOptional({ description: '客户编码（ERP，权威硬查重键）' })
  @IsOptional()
  @IsString()
  customerCode?: string

  @ApiPropertyOptional({ description: '统一社会信用代码（权威硬查重键）' })
  @IsOptional()
  @IsString()
  unifiedSocialCreditCode?: string

  @ApiPropertyOptional({ description: '产业（字典快照）' })
  @IsOptional()
  @IsString()
  industry?: string

  @ApiPropertyOptional({ description: '二级行业（字典快照）' })
  @IsOptional()
  @IsString()
  subIndustry?: string

  @ApiPropertyOptional({ description: '客户类型（字典快照）' })
  @IsOptional()
  @IsString()
  customerType?: string

  @ApiPropertyOptional({ type: [String], description: '产品线（字典快照）' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  productLines?: string[]

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  city?: string

  @ApiPropertyOptional({ description: '省份' })
  @IsOptional()
  @IsString()
  province?: string

  @ApiPropertyOptional({ description: '地址' })
  @IsOptional()
  @IsString()
  address?: string

  @ApiPropertyOptional({ description: '网址' })
  @IsOptional()
  @IsString()
  website?: string

  @ApiPropertyOptional({ description: '客户来源（字典快照）' })
  @IsOptional()
  @IsString()
  source?: string

  @ApiPropertyOptional({
    description: '客户等级 S/A/B/C',
    enum: CUSTOMER_GRADES,
    enumName: 'CustomerGrade',
  })
  @IsOptional()
  @IsIn(CUSTOMER_GRADES)
  grade?: CustomerGrade

  @ApiPropertyOptional({ description: '指定负责人（缺省=建档人，§8.3）' })
  @IsOptional()
  @IsUUID()
  ownerId?: string

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string

  @ApiProperty({ type: [CreateContactDto], description: '联系人（至少一个，且至少一个含电话）' })
  @IsArray()
  @ArrayNotEmpty({ message: '至少需要一个联系人' })
  @ValidateNested({ each: true })
  @Type(() => CreateContactDto)
  contacts!: CreateContactDto[]
}
