import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { RequirePermission } from '../access/require-permission.decorator'
import { PermissionsGuard } from '../access/permissions.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { OpportunitiesService } from './opportunities.service'
import { OpportunityCommandsService } from './opportunity-commands.service'
import { CreateOpportunityDto } from './dto/create-opportunity.dto'
import { CloseOpportunityDto } from './dto/close-opportunity.dto'
import { CreateOpportunityFollowUpDto } from './dto/create-opportunity-follow-up.dto'
import { CreateOpportunityQuoteDto } from './dto/create-opportunity-quote.dto'
import { WinOpportunityDto } from './dto/win-opportunity.dto'
import { OpportunityQueryDto } from './dto/opportunity-query.dto'

// 商机闭环：创建、结构化跟进、多次报价、明确下单、失败结案。
@ApiTags('opportunities')
@Controller('opportunities')
@UseGuards(JwtAuthGuard)
export class OpportunitiesController {
  constructor(
    private readonly opportunitiesService: OpportunitiesService,
    private readonly opportunityCommands: OpportunityCommandsService,
  ) {}

  @Post()
  @ApiCreatedResponse({ description: '新建商机；报价依据时同步生成首条报价' })
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermission('customer.write')
  create(@Body() dto: CreateOpportunityDto, @CurrentUser() user: AuthUser) {
    return this.opportunitiesService.create(dto, user)
  }

  @Get()
  @ApiOkResponse({ description: '商机列表（客户当前归属可见）' })
  list(@Query() query: OpportunityQueryDto, @CurrentUser() user: AuthUser) {
    return this.opportunitiesService.list(query, user)
  }

  @Get(':id')
  @ApiOkResponse({ description: '商机详情（含事件流与成交 Deal）' })
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.opportunitiesService.findOne(id, user)
  }

  @Post(':id/follow-ups')
  @ApiOkResponse({ description: '追加商机跟进并安排下一行动' })
  addFollowUp(
    @Param('id') id: string,
    @Body() dto: CreateOpportunityFollowUpDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.opportunityCommands.addFollowUp(id, dto, user)
  }

  @Post(':id/quotes')
  @ApiOkResponse({ description: '追加口头或正式报价；不会自动成交' })
  addQuote(
    @Param('id') id: string,
    @Body() dto: CreateOpportunityQuoteDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.opportunityCommands.addQuote(id, dto, user)
  }

  @Post(':id/win')
  @ApiOkResponse({ description: '客户明确下单，生成唯一 Deal' })
  win(@Param('id') id: string, @Body() dto: WinOpportunityDto, @CurrentUser() user: AuthUser) {
    return this.opportunityCommands.win(id, dto, user)
  }

  @Post(':id/close')
  @ApiOkResponse({ description: '结案（lost / demand_disappeared）' })
  close(@Param('id') id: string, @Body() dto: CloseOpportunityDto, @CurrentUser() user: AuthUser) {
    return this.opportunityCommands.close(id, dto, user)
  }
}
