import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator'
import { CUSTOMER_GRADES, type CustomerGrade } from '../../common/constants'

// 更新客户（§8.3：可维护 owner/管理链/admin；联系人走单独接口）
export class UpdateCustomerDto {
  @ApiProperty({ description: '读取客户时获得的版本号，用于防止覆盖他人更新', minimum: 1 })
  @IsInt()
  @Min(1)
  version!: number

  @ApiPropertyOptional({ description: '客户名称' })
  @IsOptional()
  @IsString()
  @MinLength(1, { message: '客户名称不能为空' })
  name?: string

  @ApiPropertyOptional({ description: '客户编码' })
  @IsOptional()
  @IsString()
  customerCode?: string | null

  @ApiPropertyOptional({ description: '统一社会信用代码' })
  @IsOptional()
  @IsString()
  unifiedSocialCreditCode?: string | null

  @ApiPropertyOptional({ description: '产业' })
  @IsOptional()
  @IsString()
  industry?: string | null

  @ApiPropertyOptional({ description: '二级行业' })
  @IsOptional()
  @IsString()
  subIndustry?: string | null

  @ApiPropertyOptional({ description: '客户类型' })
  @IsOptional()
  @IsString()
  customerType?: string | null

  @ApiPropertyOptional({ description: '城市' })
  @IsOptional()
  @IsString()
  city?: string | null

  @ApiPropertyOptional({ description: '省份' })
  @IsOptional()
  @IsString()
  province?: string | null

  @ApiPropertyOptional({ description: '地址' })
  @IsOptional()
  @IsString()
  address?: string | null

  @ApiPropertyOptional({ description: '网址' })
  @IsOptional()
  @IsString()
  website?: string | null

  @ApiPropertyOptional({ description: '客户来源' })
  @IsOptional()
  @IsString()
  source?: string | null

  @ApiPropertyOptional({
    description: '客户等级',
    enum: CUSTOMER_GRADES,
    enumName: 'CustomerGrade',
  })
  @IsOptional()
  @IsIn(CUSTOMER_GRADES)
  grade?: CustomerGrade

  @ApiPropertyOptional({ description: '客户等级变更原因；仅等级变化时记录' })
  @IsOptional()
  @IsString()
  gradeChangeReason?: string

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  notes?: string | null
}
