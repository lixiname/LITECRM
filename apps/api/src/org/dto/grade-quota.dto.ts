import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsInt,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { CUSTOMER_GRADES, ROLES, type CustomerGrade, type Role } from '../../common/constants'

export const CUSTOMER_GRADE_QUOTA_MODES = ['inherit', 'limited', 'unlimited'] as const
export type CustomerGradeQuotaMode = (typeof CUSTOMER_GRADE_QUOTA_MODES)[number]

export class GradeQuotaDefaultInputDto {
  @ApiProperty({ enum: CUSTOMER_GRADES, enumName: 'CustomerGrade' })
  @IsIn(CUSTOMER_GRADES)
  grade!: CustomerGrade

  @ApiProperty({ type: Number, nullable: true, description: '公司默认名额；null 表示不限' })
  @IsDefined()
  @ValidateIf((_, value) => value !== null)
  @IsInt()
  @Min(0)
  limit!: number | null
}

export class UpdateGradeQuotaDefaultsDto {
  @ApiProperty({ type: GradeQuotaDefaultInputDto, isArray: true })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => GradeQuotaDefaultInputDto)
  items!: GradeQuotaDefaultInputDto[]
}

export class UserGradeQuotaInputDto {
  @ApiProperty({ enum: CUSTOMER_GRADES, enumName: 'CustomerGrade' })
  @IsIn(CUSTOMER_GRADES)
  grade!: CustomerGrade

  @ApiProperty({ enum: CUSTOMER_GRADE_QUOTA_MODES, enumName: 'CustomerGradeQuotaMode' })
  @IsIn(CUSTOMER_GRADE_QUOTA_MODES)
  mode!: CustomerGradeQuotaMode

  @ApiPropertyOptional({ type: Number, description: 'mode=limited 时的个人上限' })
  @ValidateIf((dto: UserGradeQuotaInputDto) => dto.mode === 'limited')
  @IsInt()
  @Min(0)
  limit?: number
}

export class UpdateUserGradeQuotasDto {
  @ApiProperty({ type: UserGradeQuotaInputDto, isArray: true })
  @IsArray()
  @ArrayMinSize(4)
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => UserGradeQuotaInputDto)
  items!: UserGradeQuotaInputDto[]
}

export class GradeQuotaDefaultDto {
  @ApiProperty({ enum: CUSTOMER_GRADES, enumName: 'CustomerGrade' })
  grade!: CustomerGrade

  @ApiProperty({ type: Number, nullable: true, description: 'null 表示不限' })
  limit!: number | null
}

export class UserGradeQuotaDto {
  @ApiProperty({ enum: CUSTOMER_GRADES, enumName: 'CustomerGrade' })
  grade!: CustomerGrade

  @ApiProperty({ description: '当前在案客户数' })
  used!: number

  @ApiProperty({ enum: CUSTOMER_GRADE_QUOTA_MODES, enumName: 'CustomerGradeQuotaMode' })
  mode!: CustomerGradeQuotaMode

  @ApiProperty({ type: Number, nullable: true, description: '个人自定义值；继承时为 null' })
  overrideLimit!: number | null

  @ApiProperty({ type: Number, nullable: true, description: '最终生效上限；null 表示不限' })
  effectiveLimit!: number | null

  @ApiProperty({ type: Number, nullable: true, description: '剩余名额；不限时为 null' })
  remaining!: number | null

  @ApiProperty({ description: '当前占用是否超过生效上限' })
  exceeded!: boolean

  @ApiProperty({ description: '当前占用是否已达到或超过生效上限' })
  atCapacity!: boolean
}

export class UserGradeQuotaSummaryDto {
  @ApiProperty()
  userId!: string

  @ApiProperty()
  username!: string

  @ApiProperty()
  displayName!: string

  @ApiProperty({ enum: ROLES, enumName: 'Role' })
  role!: Role

  @ApiPropertyOptional({ type: String, nullable: true })
  region!: string | null

  @ApiProperty()
  isActive!: boolean

  @ApiProperty({ type: UserGradeQuotaDto, isArray: true })
  quotas!: UserGradeQuotaDto[]
}

export class GradeQuotaOverviewDto {
  @ApiProperty({ type: GradeQuotaDefaultDto, isArray: true })
  defaults!: GradeQuotaDefaultDto[]

  @ApiProperty({ type: UserGradeQuotaSummaryDto, isArray: true })
  users!: UserGradeQuotaSummaryDto[]
}
