import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsDateString, IsIn, IsObject, IsOptional, IsUUID } from 'class-validator'

export const CUSTOMER_IMPORT_FIELDS = [
  'name',
  'customerCode',
  'unifiedSocialCreditCode',
  'province',
  'city',
  'address',
  'industry',
  'subIndustry',
  'customerType',
  'source',
  'grade',
  'ownerUsername',
  'contactName',
  'contactPhone',
  'preCrmDealConfirmed',
  'preCrmSalesAmount',
  'notes',
] as const

export type CustomerImportField = (typeof CUSTOMER_IMPORT_FIELDS)[number]

export class PreviewCustomerImportDto {
  @ApiProperty({
    description: '目标字段到 Excel 列名的映射；name 必须映射',
    additionalProperties: { type: 'string' },
  })
  @IsObject()
  mapping!: Partial<Record<CustomerImportField, string>>

  @ApiProperty({
    enum: ['pre_crm_existing', 'prospect', 'per_row'],
    description: '批次默认客户属性',
  })
  @IsIn(['pre_crm_existing', 'prospect', 'per_row'])
  defaultRelationship!: 'pre_crm_existing' | 'prospect' | 'per_row'

  @ApiProperty({ enum: ['active', 'public'], description: '导入为在案客户或公海客户' })
  @IsIn(['active', 'public'])
  targetStatus!: 'active' | 'public'

  @ApiPropertyOptional({ description: '在案客户的批次默认负责人' })
  @IsOptional()
  @IsUUID()
  defaultOwnerId?: string

  @ApiPropertyOptional({ description: '历史累计金额的数据截止日期，YYYY-MM-DD' })
  @IsOptional()
  @IsDateString()
  dataCutoffOn?: string
}
