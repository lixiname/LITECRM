import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { PermissionsGuard } from '../access/permissions.guard'
import { RequireAnyPermission, RequirePermission } from '../access/require-permission.decorator'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ReportingQueryDto } from './dto/reporting-query.dto'
import { ReportingService } from './reporting.service'

@ApiTags('reporting')
@Controller('reporting')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequireAnyPermission('dashboard.view', 'stats.view')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Get('members')
  @ApiOkResponse({ description: '当前管理者组织树范围内可筛选人员' })
  members(@CurrentUser() user: AuthUser) {
    return this.reportingService.members(user)
  }

  @Get('overview')
  @ApiOkResponse({ description: '管理概览：经营结果、过程风险、重点客户与费用摘要' })
  overview(@Query() query: ReportingQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportingService.overview(query, user)
  }

  @Get('pipeline')
  @ApiOkResponse({ description: '当前商机池、期间推进结果与下辖人员拆分' })
  pipeline(@Query() query: ReportingQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportingService.pipeline(query, user)
  }

  @Get('my-pipeline')
  @RequirePermission()
  @RequireAnyPermission()
  @ApiOkResponse({ description: '当前登录人的开放商机金额构成与健康度摘要' })
  myPipeline(@CurrentUser() user: AuthUser) {
    return this.reportingService.myPipeline(user)
  }

  @Get('team')
  @ApiOkResponse({ description: '团队期间实际活动、当前待办与逾期摘要' })
  team(@Query() query: ReportingQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportingService.team(query, user)
  }

  @Get('key-customers')
  @ApiOkResponse({ description: 'S/A 客户风险关注清单及全部重要客户组合' })
  keyCustomers(@Query() query: ReportingQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportingService.keyCustomers(query, user)
  }

  @Get('expenses')
  @ApiOkResponse({ description: '团队已提交费用与未提交草稿摘要' })
  expenses(@Query() query: ReportingQueryDto, @CurrentUser() user: AuthUser) {
    return this.reportingService.expenses(query, user)
  }
}
