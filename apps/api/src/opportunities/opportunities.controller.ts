import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { OpportunitiesService } from './opportunities.service'
import { CreateOpportunityDto } from './dto/create-opportunity.dto'
import { AdvanceOpportunityDto } from './dto/advance-opportunity.dto'
import { CloseOpportunityDto } from './dto/close-opportunity.dto'

// 商机闭环（§8.5）：建档/推进/转成交/结案（customer.write）
@ApiTags('opportunities')
@Controller('opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunitiesController {
  constructor(private readonly opportunitiesService: OpportunitiesService) {}

  @Post()
  @ApiCreatedResponse({ description: '新建商机（意向阶段）' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.write')
  create(@Body() dto: CreateOpportunityDto, @CurrentUser() user: AuthUser) {
    return this.opportunitiesService.create(dto, user)
  }

  @Get()
  @ApiOkResponse({ description: '商机列表（客户当前归属可见）' })
  list(@Query('customerId') customerId: string | undefined, @CurrentUser() user: AuthUser) {
    return this.opportunitiesService.list(user, customerId)
  }

  @Get(':id')
  @ApiOkResponse({ description: '商机详情（含事件流与成交 Deal）' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.opportunitiesService.findOne(id, user)
  }

  @Post(':id/advance')
  @ApiOkResponse({ description: '推进 / 转订单（quoteAmount 非空=生成 Deal）' })
  advance(
    @Param('id') id: string,
    @Body() dto: AdvanceOpportunityDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.opportunitiesService.advance(id, dto, user)
  }

  @Post(':id/close')
  @ApiOkResponse({ description: '结案（lost / demand_disappeared）' })
  close(@Param('id') id: string, @Body() dto: CloseOpportunityDto, @CurrentUser() user: AuthUser) {
    return this.opportunitiesService.close(id, dto, user)
  }
}
