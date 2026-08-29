import { Body, Controller, Get, Param, Patch, Put, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import type { AuthUser } from '../auth/auth.service'
import { CurrentUser } from '../auth/current-user.decorator'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionsGuard } from '../access/permissions.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import {
  GradeQuotaOverviewDto,
  UpdateGradeQuotaDefaultsDto,
  UpdateUserGradeQuotasDto,
} from './dto/grade-quota.dto'
import { GradeQuotasService } from './grade-quotas.service'

@ApiTags('customer-grade-quotas')
@Controller('customer-grade-quotas')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('user.manage')
export class GradeQuotasController {
  constructor(private readonly service: GradeQuotasService) {}

  @Get()
  @ApiOkResponse({ type: GradeQuotaOverviewDto, description: '公司默认名额及人员占用概览' })
  getOverview() {
    return this.service.getOverview()
  }

  @Patch('defaults')
  @ApiOkResponse({ type: GradeQuotaOverviewDto, description: '更新公司默认分级名额' })
  updateDefaults(@Body() dto: UpdateGradeQuotaDefaultsDto, @CurrentUser() actor: AuthUser) {
    return this.service.updateDefaults(dto, actor.id)
  }

  @Put('users/:userId')
  @ApiOkResponse({ type: GradeQuotaOverviewDto, description: '替换指定负责人的四级名额策略' })
  updateUser(
    @Param('userId') userId: string,
    @Body() dto: UpdateUserGradeQuotasDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.service.updateUser(userId, dto, actor.id)
  }
}
