import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { CurrentUser } from '../auth/current-user.decorator'
import type { AuthUser } from '../auth/auth.service'
import { WeekViewService } from './week-view.service'

// 周览聚合（§2 个人日程）：?start=YYYY-MM-DD&end=YYYY-MM-DD
@Controller('week-view')
@UseGuards(JwtAuthGuard)
export class WeekViewController {
  constructor(private readonly weekViewService: WeekViewService) {}

  @Get()
  getWeekView(
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    if (!start || !end) throw new BadRequestException('start/end 必填（YYYY-MM-DD）')
    return this.weekViewService.getWeekView(user, start, end)
  }
}
