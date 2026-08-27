import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { ReplaceSalesPlanDto, RescheduleSalesPlanDto } from './dto/action-command.dto'
import { CreateSalesPlanDto } from './dto/create-follow-up-action.dto'
import { SalesPlansService } from './follow-up-actions.service'

@ApiTags('sales-plans')
@Controller('sales-plans')
@UseGuards(JwtAuthGuard)
export class SalesPlansController {
  constructor(private readonly plansService: SalesPlansService) {}

  @Post()
  @ApiCreatedResponse({ description: '手工安排客户拜访、商机跟进或客诉处理计划' })
  create(@Body() dto: CreateSalesPlanDto, @CurrentUser() actor: AuthUser) {
    return this.plansService.createManual(dto, actor)
  }

  @Get('week')
  @ApiOkResponse({ description: '范围内全部计划 + 更早逾期待办' })
  week(@Query('start') start: string, @Query('end') end: string, @CurrentUser() actor: AuthUser) {
    return this.plansService.week(actor, start, end)
  }

  @Get(':id')
  @ApiOkResponse({ description: '读取一条可见销售计划' })
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthUser) {
    return this.plansService.findOne(id, actor)
  }

  @Post(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleSalesPlanDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.plansService.reschedule(id, dto.version, dto.plannedAt, actor)
  }

  @Post(':id/replace')
  replace(
    @Param('id') id: string,
    @Body() dto: ReplaceSalesPlanDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.plansService.replace(id, dto, actor)
  }
}
