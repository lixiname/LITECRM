import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { VisitsService } from './visits.service'
import { CreateVisitDto } from './dto/create-visit.dto'
import { UpdateVisitEntryRulesDto, VisitEntryRulesDto } from './dto/visit-entry-rules.dto'
import { VisitEntryRulesService } from './visit-entry-rules.service'

// 拜访登记（§8.4 P0 移动端主场景）：customer.write
@ApiTags('visits')
@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(
    private readonly visitsService: VisitsService,
    private readonly entryRulesService: VisitEntryRulesService,
  ) {}

  @Get('rules')
  @ApiOkResponse({ type: VisitEntryRulesDto, description: '拜访填报字数下限，0 表示不附加限制' })
  getRules() {
    return this.entryRulesService.get()
  }

  @Patch('rules')
  @ApiOkResponse({ type: VisitEntryRulesDto, description: '更新拜访填报字数下限' })
  @UseGuards(PermissionsGuard)
  @RequirePermission('user.manage')
  updateRules(@Body() dto: UpdateVisitEntryRulesDto, @CurrentUser() user: AuthUser) {
    return this.entryRulesService.update(dto, user.id)
  }

  @Post()
  @ApiCreatedResponse({ description: '登记拜访' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.write')
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: AuthUser) {
    return this.visitsService.create(dto, user)
  }

  @Get('customer/:customerId')
  @ApiOkResponse({ description: '客户拜访时间线' })
  listByCustomer(@Param('customerId') customerId: string, @CurrentUser() user: AuthUser) {
    return this.visitsService.listByCustomer(customerId, user)
  }
}
