import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MinLength } from 'class-validator'

// 查重预检（§8.2 五步：录入时先查疑似重复，前端弹疑似列表后决定继续新建/申请接管）
export class DedupCheckDto {
  @ApiProperty({ description: '客户名称' })
  @IsString()
  @MinLength(1, { message: '客户名称不能为空' })
  name!: string

  @ApiPropertyOptional({ description: '联系人电话（电话通道，归一化精确比对）' })
  @IsOptional()
  @IsString()
  phone?: string

  @ApiPropertyOptional({ description: '地址（地址通道，去量词后精确比对）' })
  @IsOptional()
  @IsString()
  address?: string
}
