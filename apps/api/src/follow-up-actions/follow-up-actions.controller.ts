import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import {
  CancelFollowUpActionDto,
  CompleteFollowUpActionDto,
  RescheduleFollowUpActionDto,
} from './dto/action-command.dto'
import { CreateFollowUpActionDto } from './dto/create-follow-up-action.dto'
import { FollowUpActionsService } from './follow-up-actions.service'

@ApiTags('follow-up-actions')
@Controller('actions')
@UseGuards(JwtAuthGuard)
export class FollowUpActionsController {
  constructor(private readonly actionsService: FollowUpActionsService) {}

  @Post()
  @ApiCreatedResponse({ description: '手工新增未来行动' })
  create(@Body() dto: CreateFollowUpActionDto, @CurrentUser() actor: AuthUser) {
    return this.actionsService.createManual(dto, actor)
  }

  @Get('week')
  @ApiOkResponse({ description: '范围内待办 + 更早逾期待办' })
  week(@Query('start') start: string, @Query('end') end: string, @CurrentUser() actor: AuthUser) {
    return this.actionsService.week(actor, start, end)
  }

  @Post(':id/complete')
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteFollowUpActionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.actionsService.complete(id, dto.version, actor)
  }

  @Post(':id/reschedule')
  reschedule(
    @Param('id') id: string,
    @Body() dto: RescheduleFollowUpActionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.actionsService.reschedule(id, dto.version, dto.plannedAt, actor)
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Body() dto: CancelFollowUpActionDto,
    @CurrentUser() actor: AuthUser,
  ) {
    return this.actionsService.cancel(id, dto.version, dto.reason, actor)
  }
}
