import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { VisitsService } from './visits.service'
import { CreateVisitDto } from './dto/create-visit.dto'

// 拜访登记（§8.4 P0 移动端主场景）：customer.write
@ApiTags('visits')
@Controller('visits')
@UseGuards(JwtAuthGuard)
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

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
