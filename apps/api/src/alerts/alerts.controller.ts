import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common'
import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { AlertsService } from './alerts.service'
import { ReadAlertDto } from './dto/read-alert.dto'

@ApiTags('alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  @ApiOkResponse({ description: '当前用户的实时派生提醒及未读数量' })
  list(@CurrentUser() user: AuthUser) {
    return this.alertsService.list(user)
  }

  @Post('read')
  @ApiOkResponse({ description: '标记一条当前可见提醒为已读' })
  markRead(@Body() dto: ReadAlertDto, @CurrentUser() user: AuthUser) {
    return this.alertsService.markRead(dto.key, user)
  }
}
